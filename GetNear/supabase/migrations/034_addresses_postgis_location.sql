-- ============================================================================
-- Migration: 034_addresses_postgis_location
-- Purpose: Move addresses (and branch geo) to PostGIS geography(Point,4326),
--          add order delivery snapshots, and expose secure RPCs for CRUD +
--          delivery-radius validation. Safe for existing production data.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. PostGIS (Supabase installs into the extensions schema)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

COMMENT ON EXTENSION postgis IS
  'Spatial types and functions for delivery distance / radius checks.';

-- Resolve PostGIS types/functions without schema-qualifying every call.
SET search_path TO public, extensions;

-- ---------------------------------------------------------------------------
-- 2. Addresses: add geography + metadata columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS location geography(Point, 4326);

ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS formatted_address TEXT;

ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS landmark VARCHAR(255);

COMMENT ON COLUMN public.addresses.location IS
  'PostGIS geography Point (SRID 4326). Source of truth for delivery coordinates.';
COMMENT ON COLUMN public.addresses.formatted_address IS
  'Reverse-geocoded display string captured when the pin was set.';
COMMENT ON COLUMN public.addresses.landmark IS
  'Optional landmark / nearby cue editable by the customer.';

-- Backfill from legacy decimal lat/lng (lon, lat order for MakePoint).
UPDATE public.addresses
SET location = ST_SetSRID(
  ST_MakePoint(longitude::double precision, latitude::double precision),
  4326
)::geography
WHERE location IS NULL
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND latitude BETWEEN -90 AND 90
  AND longitude BETWEEN -180 AND 180;

CREATE INDEX IF NOT EXISTS idx_addresses_location_gix
  ON public.addresses
  USING GIST (location)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Restaurant branches: geography for ST_DWithin against addresses
-- ---------------------------------------------------------------------------
ALTER TABLE public.restaurant_branches
  ADD COLUMN IF NOT EXISTS location geography(Point, 4326);

UPDATE public.restaurant_branches
SET location = ST_SetSRID(
  ST_MakePoint(longitude::double precision, latitude::double precision),
  4326
)::geography
WHERE location IS NULL
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_restaurant_branches_location_gix
  ON public.restaurant_branches
  USING GIST (location)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 4. Orders: immutable delivery snapshot (never depend only on live address)
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_snapshot JSONB;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_location geography(Point, 4326);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_distance_m NUMERIC(12, 2);

COMMENT ON COLUMN public.orders.delivery_snapshot IS
  'Immutable copy of delivery address fields at place-order time.';
COMMENT ON COLUMN public.orders.delivery_location IS
  'Geography snapshot of the delivery pin at place-order time.';
COMMENT ON COLUMN public.orders.delivery_distance_m IS
  'Great-circle distance in meters from branch to delivery pin at checkout.';

-- Auto-copy geography pin when the client sends snapshot/distance only.
CREATE OR REPLACE FUNCTION public.orders_fill_delivery_geo()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.delivery_location IS NULL AND NEW.address_id IS NOT NULL THEN
    SELECT a.location
      INTO NEW.delivery_location
      FROM public.addresses a
     WHERE a.id = NEW.address_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_fill_delivery_geo ON public.orders;
CREATE TRIGGER trg_orders_fill_delivery_geo
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_fill_delivery_geo();

-- ---------------------------------------------------------------------------
-- 5. Drop legacy lat/lng columns (after successful backfill)
-- ---------------------------------------------------------------------------
ALTER TABLE public.addresses
  DROP CONSTRAINT IF EXISTS addresses_latitude_range;
ALTER TABLE public.addresses
  DROP CONSTRAINT IF EXISTS addresses_longitude_range;

ALTER TABLE public.addresses
  DROP COLUMN IF EXISTS latitude;
ALTER TABLE public.addresses
  DROP COLUMN IF EXISTS longitude;

ALTER TABLE public.restaurant_branches
  DROP CONSTRAINT IF EXISTS restaurant_branches_latitude_range;
ALTER TABLE public.restaurant_branches
  DROP CONSTRAINT IF EXISTS restaurant_branches_longitude_range;

DROP INDEX IF EXISTS idx_restaurant_branches_geo;

ALTER TABLE public.restaurant_branches
  DROP COLUMN IF EXISTS latitude;
ALTER TABLE public.restaurant_branches
  DROP COLUMN IF EXISTS longitude;

-- ---------------------------------------------------------------------------
-- 6. Helper: parse GeoJSON-ish coords for API responses
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.geo_point_lat(loc geography)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE WHEN loc IS NULL THEN NULL ELSE ST_Y(loc::geometry) END;
$$;

CREATE OR REPLACE FUNCTION public.geo_point_lng(loc geography)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE WHEN loc IS NULL THEN NULL ELSE ST_X(loc::geometry) END;
$$;

-- ---------------------------------------------------------------------------
-- 7. ensure_main_branch â€” write location instead of lat/lng
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_main_branch(p_restaurant_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_branch_id UUID;
  v_rest RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, name, location_label, contact_phone
    INTO v_rest
    FROM public.restaurants
   WHERE id = p_restaurant_id
     AND deleted_at IS NULL;

  IF v_rest.id IS NULL THEN
    RAISE EXCEPTION 'Restaurant not found';
  END IF;

  SELECT b.id INTO v_branch_id
    FROM public.restaurant_branches b
   WHERE b.restaurant_id = p_restaurant_id
     AND b.deleted_at IS NULL
     AND b.is_active = TRUE
   ORDER BY b.is_main_branch DESC, b.created_at ASC
   LIMIT 1;

  IF v_branch_id IS NOT NULL THEN
    RETURN v_branch_id;
  END IF;

  INSERT INTO public.restaurant_branches (
    restaurant_id,
    name,
    address_line1,
    city,
    state,
    pincode,
    location,
    phone,
    is_main_branch,
    is_active
  ) VALUES (
    p_restaurant_id,
    COALESCE(NULLIF(trim(v_rest.name), ''), 'Main branch') || ' - Main',
    COALESCE(NULLIF(trim(v_rest.location_label), ''), 'Local area'),
    'Mumbai',
    'Maharashtra',
    '400001',
    ST_SetSRID(ST_MakePoint(72.8777, 19.0760), 4326)::geography,
    v_rest.contact_phone,
    TRUE,
    TRUE
  )
  RETURNING id INTO v_branch_id;

  RETURN v_branch_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_main_branch(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. Address CRUD RPCs (location as lat/lng args â†’ geography)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_customer_address(
  p_label TEXT,
  p_full_name TEXT,
  p_phone TEXT,
  p_address_line1 TEXT,
  p_address_line2 TEXT,
  p_city TEXT,
  p_state TEXT,
  p_pincode TEXT,
  p_country TEXT,
  p_landmark TEXT,
  p_formatted_address TEXT,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_is_default BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID := public.current_app_user_id();
  v_dup UUID;
  v_row public.addresses%ROWTYPE;
  v_loc geography(Point, 4326);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_latitude IS NULL OR p_longitude IS NULL
     OR p_latitude < -90 OR p_latitude > 90
     OR p_longitude < -180 OR p_longitude > 180 THEN
    RAISE EXCEPTION 'Valid coordinates are required';
  END IF;

  v_loc := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography;

  -- Near-duplicate guard (~25 m) for the same user.
  SELECT a.id INTO v_dup
    FROM public.addresses a
   WHERE a.user_id = v_user_id
     AND a.deleted_at IS NULL
     AND a.location IS NOT NULL
     AND ST_DWithin(a.location, v_loc, 25)
   LIMIT 1;

  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION 'An address already exists near this location';
  END IF;

  IF p_is_default OR NOT EXISTS (
    SELECT 1 FROM public.addresses
     WHERE user_id = v_user_id AND deleted_at IS NULL
  ) THEN
    UPDATE public.addresses
       SET is_default = FALSE
     WHERE user_id = v_user_id
       AND is_default = TRUE
       AND deleted_at IS NULL;
    p_is_default := TRUE;
  END IF;

  INSERT INTO public.addresses (
    user_id, label, full_name, phone,
    address_line1, address_line2, city, state, pincode, country,
    landmark, formatted_address, location, is_default
  ) VALUES (
    v_user_id,
    COALESCE(NULLIF(lower(trim(p_label)), ''), 'home'),
    trim(p_full_name),
    trim(p_phone),
    trim(p_address_line1),
    NULLIF(trim(COALESCE(p_address_line2, '')), ''),
    trim(p_city),
    trim(p_state),
    trim(p_pincode),
    COALESCE(NULLIF(trim(p_country), ''), 'India'),
    NULLIF(trim(COALESCE(p_landmark, '')), ''),
    NULLIF(trim(COALESCE(p_formatted_address, '')), ''),
    v_loc,
    COALESCE(p_is_default, FALSE)
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'user_id', v_row.user_id,
    'label', v_row.label,
    'full_name', v_row.full_name,
    'phone', v_row.phone,
    'address_line1', v_row.address_line1,
    'address_line2', v_row.address_line2,
    'city', v_row.city,
    'state', v_row.state,
    'pincode', v_row.pincode,
    'country', v_row.country,
    'landmark', v_row.landmark,
    'formatted_address', v_row.formatted_address,
    'is_default', v_row.is_default,
    'created_at', v_row.created_at,
    'latitude', public.geo_point_lat(v_row.location),
    'longitude', public.geo_point_lng(v_row.location)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_customer_address(
  p_address_id UUID,
  p_label TEXT,
  p_full_name TEXT,
  p_phone TEXT,
  p_address_line1 TEXT,
  p_address_line2 TEXT,
  p_city TEXT,
  p_state TEXT,
  p_pincode TEXT,
  p_country TEXT,
  p_landmark TEXT,
  p_formatted_address TEXT,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_is_default BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID := public.current_app_user_id();
  v_dup UUID;
  v_row public.addresses%ROWTYPE;
  v_loc geography(Point, 4326);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.addresses
     WHERE id = p_address_id
       AND user_id = v_user_id
       AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Address not found';
  END IF;

  IF p_latitude IS NULL OR p_longitude IS NULL
     OR p_latitude < -90 OR p_latitude > 90
     OR p_longitude < -180 OR p_longitude > 180 THEN
    RAISE EXCEPTION 'Valid coordinates are required';
  END IF;

  v_loc := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography;

  SELECT a.id INTO v_dup
    FROM public.addresses a
   WHERE a.user_id = v_user_id
     AND a.deleted_at IS NULL
     AND a.id <> p_address_id
     AND a.location IS NOT NULL
     AND ST_DWithin(a.location, v_loc, 25)
   LIMIT 1;

  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION 'An address already exists near this location';
  END IF;

  IF COALESCE(p_is_default, FALSE) THEN
    UPDATE public.addresses
       SET is_default = FALSE
     WHERE user_id = v_user_id
       AND is_default = TRUE
       AND deleted_at IS NULL
       AND id <> p_address_id;
  END IF;

  UPDATE public.addresses
     SET label = COALESCE(NULLIF(lower(trim(p_label)), ''), 'home'),
         full_name = trim(p_full_name),
         phone = trim(p_phone),
         address_line1 = trim(p_address_line1),
         address_line2 = NULLIF(trim(COALESCE(p_address_line2, '')), ''),
         city = trim(p_city),
         state = trim(p_state),
         pincode = trim(p_pincode),
         country = COALESCE(NULLIF(trim(p_country), ''), 'India'),
         landmark = NULLIF(trim(COALESCE(p_landmark, '')), ''),
         formatted_address = NULLIF(trim(COALESCE(p_formatted_address, '')), ''),
         location = v_loc,
         is_default = COALESCE(p_is_default, FALSE)
   WHERE id = p_address_id
     AND user_id = v_user_id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'user_id', v_row.user_id,
    'label', v_row.label,
    'full_name', v_row.full_name,
    'phone', v_row.phone,
    'address_line1', v_row.address_line1,
    'address_line2', v_row.address_line2,
    'city', v_row.city,
    'state', v_row.state,
    'pincode', v_row.pincode,
    'country', v_row.country,
    'landmark', v_row.landmark,
    'formatted_address', v_row.formatted_address,
    'is_default', v_row.is_default,
    'created_at', v_row.created_at,
    'latitude', public.geo_point_lat(v_row.location),
    'longitude', public.geo_point_lng(v_row.location)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_customer_addresses()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID := public.current_app_user_id();
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT
        a.id,
        a.user_id,
        a.label,
        a.full_name,
        a.phone,
        a.address_line1,
        a.address_line2,
        a.city,
        a.state,
        a.pincode,
        a.country,
        a.landmark,
        a.formatted_address,
        a.is_default,
        a.created_at,
        public.geo_point_lat(a.location) AS latitude,
        public.geo_point_lng(a.location) AS longitude
      FROM public.addresses a
      WHERE a.user_id = v_user_id
        AND a.deleted_at IS NULL
      ORDER BY a.is_default DESC, a.created_at DESC
    ) t;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_customer_address(p_address_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID := public.current_app_user_id();
  v_row RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT
    a.id,
    a.user_id,
    a.label,
    a.full_name,
    a.phone,
    a.address_line1,
    a.address_line2,
    a.city,
    a.state,
    a.pincode,
    a.country,
    a.landmark,
    a.formatted_address,
    a.is_default,
    a.created_at,
    public.geo_point_lat(a.location) AS latitude,
    public.geo_point_lng(a.location) AS longitude
  INTO v_row
  FROM public.addresses a
  WHERE a.id = p_address_id
    AND a.deleted_at IS NULL
    AND (
      a.user_id = v_user_id
      OR public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.orders o
         WHERE o.address_id = a.id
           AND (
             o.customer_id = v_user_id
             OR public.is_restaurant_owner_of(o.restaurant_id)
           )
      )
    );

  IF v_row.id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN row_to_json(v_row)::jsonb;
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. Delivery radius validation (PostGIS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_delivery_radius(
  p_address_id UUID,
  p_branch_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID := public.current_app_user_id();
  v_addr public.addresses%ROWTYPE;
  v_branch public.restaurant_branches%ROWTYPE;
  v_distance_m DOUBLE PRECISION;
  v_radius_m DOUBLE PRECISION;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_addr
    FROM public.addresses
   WHERE id = p_address_id
     AND deleted_at IS NULL;

  IF v_addr.id IS NULL THEN
    RAISE EXCEPTION 'Address not found';
  END IF;

  IF v_addr.user_id <> v_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Selected address is invalid';
  END IF;

  IF v_addr.location IS NULL THEN
    RAISE EXCEPTION 'Address is missing a map location. Please update it.';
  END IF;

  SELECT * INTO v_branch
    FROM public.restaurant_branches
   WHERE id = p_branch_id
     AND deleted_at IS NULL
     AND is_active = TRUE;

  IF v_branch.id IS NULL THEN
    RAISE EXCEPTION 'Restaurant branch not found';
  END IF;

  IF v_branch.location IS NULL THEN
    RAISE EXCEPTION 'Restaurant branch location is not configured';
  END IF;

  v_radius_m := GREATEST(COALESCE(v_branch.delivery_radius_km, 5)::double precision, 0.1) * 1000.0;
  v_distance_m := ST_Distance(v_addr.location, v_branch.location);

  IF NOT ST_DWithin(v_addr.location, v_branch.location, v_radius_m) THEN
    RAISE EXCEPTION
      'This address is outside the delivery area (%.1f km away, max %.1f km)',
      v_distance_m / 1000.0,
      v_radius_m / 1000.0;
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'distance_m', round(v_distance_m::numeric, 2),
    'radius_m', round(v_radius_m::numeric, 2),
    'snapshot', jsonb_build_object(
      'full_name', v_addr.full_name,
      'phone', v_addr.phone,
      'label', v_addr.label,
      'address_line1', v_addr.address_line1,
      'address_line2', v_addr.address_line2,
      'landmark', v_addr.landmark,
      'city', v_addr.city,
      'state', v_addr.state,
      'pincode', v_addr.pincode,
      'country', v_addr.country,
      'formatted_address', v_addr.formatted_address,
      'latitude', public.geo_point_lat(v_addr.location),
      'longitude', public.geo_point_lng(v_addr.location)
    ),
    'delivery_location_ewkt', ST_AsEWKT(v_addr.location)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_customer_address(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.update_customer_address(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.list_customer_addresses() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_address(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_delivery_radius(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.geo_point_lat(geography) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.geo_point_lng(geography) TO authenticated, anon;

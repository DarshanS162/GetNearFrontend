-- ============================================================================
-- Migration: 035_delivery_radius_everywhere
-- Purpose: Allow delivery_radius_km = 0 to mean "deliver everywhere" (no
--          distance check). Update constraint + validate_delivery_radius RPC.
-- ============================================================================

-- 1. Relax the CHECK constraint: allow 0 (everywhere) in addition to > 0
ALTER TABLE public.restaurant_branches
  DROP CONSTRAINT IF EXISTS restaurant_branches_delivery_radius_positive;

ALTER TABLE public.restaurant_branches
  ADD CONSTRAINT restaurant_branches_delivery_radius_non_negative
  CHECK (delivery_radius_km >= 0);

-- 2. Update the delivery radius validation RPC to skip check when radius = 0
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

  v_distance_m := ST_Distance(v_addr.location, v_branch.location);

  -- radius_km = 0 means "deliver everywhere": skip the distance check
  IF COALESCE(v_branch.delivery_radius_km, 5) > 0 THEN
    v_radius_m := v_branch.delivery_radius_km::double precision * 1000.0;

    IF NOT ST_DWithin(v_addr.location, v_branch.location, v_radius_m) THEN
      RAISE EXCEPTION
        'Sorry, this store does not deliver to your selected address';
    END IF;
  ELSE
    v_radius_m := 0;
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

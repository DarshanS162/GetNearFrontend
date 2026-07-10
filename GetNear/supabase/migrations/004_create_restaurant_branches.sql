-- ============================================================================
-- Migration: 004_create_restaurant_branches
-- Purpose: Physical/virtual outlets per restaurant. Used for nearest-branch
--          selection based on customer geolocation.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.restaurant_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    phone VARCHAR(20),
    is_main_branch BOOLEAN NOT NULL DEFAULT FALSE,
    delivery_radius_km DECIMAL(6, 2) NOT NULL DEFAULT 5.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT restaurant_branches_name_not_empty CHECK (char_length(trim(name)) > 0),
    CONSTRAINT restaurant_branches_latitude_range CHECK (latitude >= -90 AND latitude <= 90),
    CONSTRAINT restaurant_branches_longitude_range CHECK (longitude >= -180 AND longitude <= 180),
    CONSTRAINT restaurant_branches_delivery_radius_positive CHECK (delivery_radius_km > 0),
    CONSTRAINT restaurant_branches_pincode_format CHECK (pincode ~ '^[0-9]{6}$'),

    CONSTRAINT fk_restaurant_branches_restaurant_id
        FOREIGN KEY (restaurant_id)
        REFERENCES public.restaurants (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.restaurant_branches IS
    'Restaurant branch/outlet locations. Supports multi-branch delivery and geo-based routing.';

COMMENT ON COLUMN public.restaurant_branches.latitude IS
    'Branch latitude for Haversine distance calculation against customer location.';

COMMENT ON COLUMN public.restaurant_branches.longitude IS
    'Branch longitude for Haversine distance calculation against customer location.';

COMMENT ON COLUMN public.restaurant_branches.is_main_branch IS
    'Flags the primary branch when multiple branches exist for one restaurant.';

CREATE INDEX IF NOT EXISTS idx_restaurant_branches_restaurant_id
    ON public.restaurant_branches (restaurant_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_branches_city ON public.restaurant_branches (city);
CREATE INDEX IF NOT EXISTS idx_restaurant_branches_pincode ON public.restaurant_branches (pincode);
CREATE INDEX IF NOT EXISTS idx_restaurant_branches_is_active ON public.restaurant_branches (is_active);
CREATE INDEX IF NOT EXISTS idx_restaurant_branches_geo
    ON public.restaurant_branches (latitude, longitude);

CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_branches_main_branch
    ON public.restaurant_branches (restaurant_id)
    WHERE is_main_branch = TRUE AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_restaurant_branches_updated_at ON public.restaurant_branches;
CREATE TRIGGER trg_restaurant_branches_updated_at
    BEFORE UPDATE ON public.restaurant_branches
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

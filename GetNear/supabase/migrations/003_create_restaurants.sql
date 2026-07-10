-- ============================================================================
-- Migration: 003_create_restaurants
-- Purpose: Core restaurant entity. Designed for multi-restaurant scalability
--          while supporting single-restaurant launch.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    description TEXT,
    gst_number VARCHAR(20),
    fssai_number VARCHAR(20),
    logo_url TEXT,
    banner_url TEXT,
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    business_status VARCHAR(30) NOT NULL DEFAULT 'active',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT restaurants_name_not_empty CHECK (char_length(trim(name)) > 0),
    CONSTRAINT restaurants_slug_not_empty CHECK (char_length(trim(slug)) > 0),
    CONSTRAINT restaurants_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT restaurants_business_status_check CHECK (
        business_status IN ('active', 'inactive', 'suspended', 'pending_approval')
    ),
    CONSTRAINT restaurants_contact_email_format CHECK (
        contact_email IS NULL OR contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    ),

    CONSTRAINT fk_restaurants_owner_id
        FOREIGN KEY (owner_id)
        REFERENCES public.users (id)
        ON DELETE SET NULL
);

COMMENT ON TABLE public.restaurants IS
    'Restaurant master record. Each restaurant can have multiple branches and a full catalog.';

COMMENT ON COLUMN public.restaurants.gst_number IS 'Indian GST registration number for tax compliance.';
COMMENT ON COLUMN public.restaurants.fssai_number IS 'Food safety license number (FSSAI).';
COMMENT ON COLUMN public.restaurants.business_status IS
    'Operational status: active, inactive, suspended, pending_approval.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurants_slug_active
    ON public.restaurants (slug)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON public.restaurants (owner_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_business_status ON public.restaurants (business_status);
CREATE INDEX IF NOT EXISTS idx_restaurants_is_active ON public.restaurants (is_active);
CREATE INDEX IF NOT EXISTS idx_restaurants_name ON public.restaurants (name);

DROP TRIGGER IF EXISTS trg_restaurants_updated_at ON public.restaurants;
CREATE TRIGGER trg_restaurants_updated_at
    BEFORE UPDATE ON public.restaurants
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

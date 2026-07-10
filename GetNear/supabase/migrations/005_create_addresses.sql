-- ============================================================================
-- Migration: 005_create_addresses
-- Purpose: Customer delivery addresses linked to application users.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    label VARCHAR(50) NOT NULL DEFAULT 'home',
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT addresses_label_check CHECK (label IN ('home', 'work', 'other')),
    CONSTRAINT addresses_full_name_not_empty CHECK (char_length(trim(full_name)) > 0),
    CONSTRAINT addresses_phone_not_empty CHECK (char_length(trim(phone)) >= 10),
    CONSTRAINT addresses_pincode_format CHECK (pincode ~ '^[0-9]{6}$'),
    CONSTRAINT addresses_latitude_range CHECK (
        latitude IS NULL OR (latitude >= -90 AND latitude <= 90)
    ),
    CONSTRAINT addresses_longitude_range CHECK (
        longitude IS NULL OR (longitude >= -180 AND longitude <= 180)
    ),

    CONSTRAINT fk_addresses_user_id
        FOREIGN KEY (user_id)
        REFERENCES public.users (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.addresses IS
    'Saved delivery addresses for authenticated customers at checkout.';

COMMENT ON COLUMN public.addresses.is_default IS
    'Default address auto-selected during checkout. Enforce one default per user in app logic.';

CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON public.addresses (user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_pincode ON public.addresses (pincode);
CREATE INDEX IF NOT EXISTS idx_addresses_city ON public.addresses (city);
CREATE INDEX IF NOT EXISTS idx_addresses_is_default ON public.addresses (user_id, is_default);

CREATE UNIQUE INDEX IF NOT EXISTS idx_addresses_user_default
    ON public.addresses (user_id)
    WHERE is_default = TRUE AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_addresses_updated_at ON public.addresses;
CREATE TRIGGER trg_addresses_updated_at
    BEFORE UPDATE ON public.addresses
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

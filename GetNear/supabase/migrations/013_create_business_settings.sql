-- ============================================================================
-- Migration: 013_create_business_settings
-- Purpose: Per-restaurant operational and tax configuration.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.business_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 5.00,
    min_order_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    enable_cod BOOLEAN NOT NULL DEFAULT FALSE,
    enable_online_payment BOOLEAN NOT NULL DEFAULT TRUE,
    order_prefix VARCHAR(10) NOT NULL DEFAULT 'GN',
    support_phone VARCHAR(20),
    support_email VARCHAR(255),
    additional_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT business_settings_tax_rate_non_negative CHECK (tax_rate >= 0),
    CONSTRAINT business_settings_min_order_non_negative CHECK (min_order_amount >= 0),
    CONSTRAINT business_settings_currency_not_empty CHECK (char_length(trim(currency)) > 0),

    CONSTRAINT fk_business_settings_restaurant_id
        FOREIGN KEY (restaurant_id)
        REFERENCES public.restaurants (id)
        ON DELETE CASCADE,

    CONSTRAINT business_settings_restaurant_unique UNIQUE (restaurant_id)
);

COMMENT ON TABLE public.business_settings IS
    'Restaurant-level business rules: tax, minimum order, payment modes, and extensible JSON config.';

COMMENT ON COLUMN public.business_settings.additional_settings IS
    'JSONB extension point for future settings without schema migration.';

CREATE INDEX IF NOT EXISTS idx_business_settings_restaurant_id
    ON public.business_settings (restaurant_id);

DROP TRIGGER IF EXISTS trg_business_settings_updated_at ON public.business_settings;
CREATE TRIGGER trg_business_settings_updated_at
    BEFORE UPDATE ON public.business_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

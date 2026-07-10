-- ============================================================================
-- Migration: 012_create_offers
-- Purpose: Marketing offers and banners displayed on customer-facing UI.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    offer_type VARCHAR(30) NOT NULL DEFAULT 'banner',
    discount_value DECIMAL(10, 2),
    image_url TEXT,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT offers_title_not_empty CHECK (char_length(trim(title)) > 0),
    CONSTRAINT offers_type_check CHECK (
        offer_type IN ('banner', 'flat_discount', 'percentage_discount', 'free_delivery')
    ),
    CONSTRAINT offers_validity_check CHECK (
        valid_until IS NULL OR valid_until > valid_from
    ),

    CONSTRAINT fk_offers_restaurant_id
        FOREIGN KEY (restaurant_id)
        REFERENCES public.restaurants (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.offers IS
    'Promotional offers for homepage banners and campaign-driven discounts.';

CREATE INDEX IF NOT EXISTS idx_offers_restaurant_id ON public.offers (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_offers_is_active ON public.offers (is_active);
CREATE INDEX IF NOT EXISTS idx_offers_validity ON public.offers (valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_offers_offer_type ON public.offers (offer_type);

DROP TRIGGER IF EXISTS trg_offers_updated_at ON public.offers;
CREATE TRIGGER trg_offers_updated_at
    BEFORE UPDATE ON public.offers
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

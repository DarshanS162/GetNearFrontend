-- ============================================================================
-- Migration: 011_create_coupons
-- Purpose: Discount coupons managed by admin per restaurant.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    title VARCHAR(150),
    description TEXT,
    discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage',
    discount_value DECIMAL(10, 2) NOT NULL,
    min_order_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    max_discount_amount DECIMAL(10, 2),
    usage_limit INTEGER,
    usage_count INTEGER NOT NULL DEFAULT 0,
    per_user_limit INTEGER NOT NULL DEFAULT 1,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT coupons_code_not_empty CHECK (char_length(trim(code)) > 0),
    CONSTRAINT coupons_discount_type_check CHECK (discount_type IN ('percentage', 'flat')),
    CONSTRAINT coupons_discount_value_positive CHECK (discount_value > 0),
    CONSTRAINT coupons_min_order_non_negative CHECK (min_order_amount >= 0),
    CONSTRAINT coupons_usage_count_non_negative CHECK (usage_count >= 0),
    CONSTRAINT coupons_usage_limit_positive CHECK (usage_limit IS NULL OR usage_limit > 0),
    CONSTRAINT coupons_per_user_limit_positive CHECK (per_user_limit > 0),
    CONSTRAINT coupons_percentage_max CHECK (
        discount_type != 'percentage' OR discount_value <= 100
    ),
    CONSTRAINT coupons_validity_check CHECK (
        valid_until IS NULL OR valid_until > valid_from
    ),

    CONSTRAINT fk_coupons_restaurant_id
        FOREIGN KEY (restaurant_id)
        REFERENCES public.restaurants (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.coupons IS
    'Promotional coupon codes applied at checkout with usage limits and validity windows.';

COMMENT ON COLUMN public.coupons.per_user_limit IS
    'Maximum times a single customer can redeem this coupon.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_restaurant_code_active
    ON public.coupons (restaurant_id, upper(code))
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_coupons_restaurant_id ON public.coupons (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON public.coupons (is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_validity ON public.coupons (valid_from, valid_until);

DROP TRIGGER IF EXISTS trg_coupons_updated_at ON public.coupons;
CREATE TRIGGER trg_coupons_updated_at
    BEFORE UPDATE ON public.coupons
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

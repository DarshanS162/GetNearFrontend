-- ============================================================================
-- Migration: 020_create_coupon_usages
-- Purpose: Tracks coupon redemption per user and order for limit enforcement.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.coupon_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL,
    user_id UUID NOT NULL,
    order_id UUID NOT NULL,
    discount_applied DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT coupon_usages_discount_non_negative CHECK (discount_applied >= 0),

    CONSTRAINT fk_coupon_usages_coupon_id
        FOREIGN KEY (coupon_id)
        REFERENCES public.coupons (id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_coupon_usages_user_id
        FOREIGN KEY (user_id)
        REFERENCES public.users (id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_coupon_usages_order_id
        FOREIGN KEY (order_id)
        REFERENCES public.orders (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.coupon_usages IS
    'Immutable coupon redemption records for analytics and per-user usage limits.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_usages_order_unique
    ON public.coupon_usages (order_id);

CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon_id ON public.coupon_usages (coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_user_id ON public.coupon_usages (user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon_user
    ON public.coupon_usages (coupon_id, user_id);

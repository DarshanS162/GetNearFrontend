-- ============================================================================
-- Migration: 009_create_cart
-- Purpose: Shopping cart for guest and authenticated users before checkout.
--          Guest carts use session_id; logged-in users use user_id.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cart (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    session_id VARCHAR(255),
    restaurant_branch_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT cart_owner_required CHECK (
        user_id IS NOT NULL OR session_id IS NOT NULL
    ),

    CONSTRAINT fk_cart_user_id
        FOREIGN KEY (user_id)
        REFERENCES public.users (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_cart_restaurant_branch_id
        FOREIGN KEY (restaurant_branch_id)
        REFERENCES public.restaurant_branches (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.cart IS
    'Pre-checkout cart container. Supports anonymous browsing with session-based carts.';

COMMENT ON COLUMN public.cart.session_id IS
    'Browser session identifier for guest cart before phone OTP login.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_user_branch
    ON public.cart (user_id, restaurant_branch_id)
    WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_session_branch
    ON public.cart (session_id, restaurant_branch_id)
    WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cart_restaurant_branch_id ON public.cart (restaurant_branch_id);

DROP TRIGGER IF EXISTS trg_cart_updated_at ON public.cart;
CREATE TRIGGER trg_cart_updated_at
    BEFORE UPDATE ON public.cart
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

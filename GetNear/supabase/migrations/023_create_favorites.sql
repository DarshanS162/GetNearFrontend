-- ============================================================================
-- Migration: 023_create_favorites
-- Purpose: Customer saved/favorite products for quick reordering.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    product_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_favorites_user_id
        FOREIGN KEY (user_id)
        REFERENCES public.users (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_favorites_product_id
        FOREIGN KEY (product_id)
        REFERENCES public.products (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.favorites IS
    'User wishlist/favorites for frequently ordered menu items.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_user_product
    ON public.favorites (user_id, product_id);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites (user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_product_id ON public.favorites (product_id);

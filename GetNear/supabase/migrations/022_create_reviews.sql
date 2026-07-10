-- ============================================================================
-- Migration: 022_create_reviews
-- Purpose: Customer ratings and feedback for orders and products.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    order_id UUID NOT NULL,
    restaurant_id UUID NOT NULL,
    product_id UUID,
    rating SMALLINT NOT NULL,
    comment TEXT,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT reviews_rating_range CHECK (rating >= 1 AND rating <= 5),

    CONSTRAINT fk_reviews_user_id
        FOREIGN KEY (user_id)
        REFERENCES public.users (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_reviews_order_id
        FOREIGN KEY (order_id)
        REFERENCES public.orders (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_reviews_restaurant_id
        FOREIGN KEY (restaurant_id)
        REFERENCES public.restaurants (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_reviews_product_id
        FOREIGN KEY (product_id)
        REFERENCES public.products (id)
        ON DELETE SET NULL
);

COMMENT ON TABLE public.reviews IS
    'Post-delivery customer reviews. product_id optional for restaurant-level ratings.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_user_order_product
    ON public.reviews (user_id, order_id, COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::uuid))
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_id ON public.reviews (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews (product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON public.reviews (rating);
CREATE INDEX IF NOT EXISTS idx_reviews_is_visible ON public.reviews (is_visible);

DROP TRIGGER IF EXISTS trg_reviews_updated_at ON public.reviews;
CREATE TRIGGER trg_reviews_updated_at
    BEFORE UPDATE ON public.reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

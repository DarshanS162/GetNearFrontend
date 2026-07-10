-- ============================================================================
-- Migration: 010_create_cart_items
-- Purpose: Line items inside a cart with quantity and price snapshot.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT cart_items_quantity_positive CHECK (quantity > 0),
    CONSTRAINT cart_items_unit_price_non_negative CHECK (unit_price >= 0),

    CONSTRAINT fk_cart_items_cart_id
        FOREIGN KEY (cart_id)
        REFERENCES public.cart (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_cart_items_product_id
        FOREIGN KEY (product_id)
        REFERENCES public.products (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.cart_items IS
    'Individual products added to cart. unit_price snapshots current selling price.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_cart_product
    ON public.cart_items (cart_id, product_id);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON public.cart_items (cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON public.cart_items (product_id);

DROP TRIGGER IF EXISTS trg_cart_items_updated_at ON public.cart_items;
CREATE TRIGGER trg_cart_items_updated_at
    BEFORE UPDATE ON public.cart_items
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

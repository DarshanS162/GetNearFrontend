-- ============================================================================
-- Migration: 018_create_order_items
-- Purpose: Immutable line-item snapshot for each product in an order.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    product_id UUID NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    food_type VARCHAR(20) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT order_items_quantity_positive CHECK (quantity > 0),
    CONSTRAINT order_items_unit_price_non_negative CHECK (unit_price >= 0),
    CONSTRAINT order_items_total_price_non_negative CHECK (total_price >= 0),
    CONSTRAINT order_items_food_type_check CHECK (food_type IN ('veg', 'non_veg', 'egg')),
    CONSTRAINT order_items_product_name_not_empty CHECK (char_length(trim(product_name)) > 0),
    CONSTRAINT order_items_total_matches CHECK (total_price = (unit_price * quantity)),

    CONSTRAINT fk_order_items_order_id
        FOREIGN KEY (order_id)
        REFERENCES public.orders (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_order_items_product_id
        FOREIGN KEY (product_id)
        REFERENCES public.products (id)
        ON DELETE RESTRICT
);

COMMENT ON TABLE public.order_items IS
    'Order line items with denormalized product snapshot for historical accuracy.';

COMMENT ON COLUMN public.order_items.product_name IS
    'Snapshot of product name at order time; survives future product renames.';

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items (product_id);

DROP TRIGGER IF EXISTS trg_order_items_updated_at ON public.order_items;
CREATE TRIGGER trg_order_items_updated_at
    BEFORE UPDATE ON public.order_items
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

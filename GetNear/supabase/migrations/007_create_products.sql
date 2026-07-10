-- ============================================================================
-- Migration: 007_create_products
-- Purpose: Menu items with pricing, availability, and dietary classification.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    category_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    description TEXT,
    food_type VARCHAR(20) NOT NULL DEFAULT 'veg',
    mrp DECIMAL(10, 2) NOT NULL,
    selling_price DECIMAL(10, 2) NOT NULL,
    discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    preparation_time_minutes INTEGER NOT NULL DEFAULT 15,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    primary_image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT products_name_not_empty CHECK (char_length(trim(name)) > 0),
    CONSTRAINT products_food_type_check CHECK (food_type IN ('veg', 'non_veg', 'egg')),
    CONSTRAINT products_mrp_positive CHECK (mrp >= 0),
    CONSTRAINT products_selling_price_positive CHECK (selling_price >= 0),
    CONSTRAINT products_selling_price_lte_mrp CHECK (selling_price <= mrp),
    CONSTRAINT products_discount_non_negative CHECK (discount_amount >= 0),
    CONSTRAINT products_preparation_time_positive CHECK (preparation_time_minutes > 0),

    CONSTRAINT fk_products_restaurant_id
        FOREIGN KEY (restaurant_id)
        REFERENCES public.restaurants (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_products_category_id
        FOREIGN KEY (category_id)
        REFERENCES public.categories (id)
        ON DELETE RESTRICT
);

COMMENT ON TABLE public.products IS
    'Restaurant menu products. Supports search, filter, cart, and order line items.';

COMMENT ON COLUMN public.products.food_type IS 'Dietary classification: veg, non_veg, or egg.';
COMMENT ON COLUMN public.products.mrp IS 'Maximum retail price before discount.';
COMMENT ON COLUMN public.products.selling_price IS 'Customer-facing price after discount.';
COMMENT ON COLUMN public.products.primary_image_url IS
    'Denormalized primary image for fast menu listing; detailed images in product_images.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_restaurant_slug_active
    ON public.products (restaurant_id, slug)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_restaurant_id ON public.products (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products (name);
CREATE INDEX IF NOT EXISTS idx_products_food_type ON public.products (food_type);
CREATE INDEX IF NOT EXISTS idx_products_is_available ON public.products (is_available);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON public.products (is_featured);
CREATE INDEX IF NOT EXISTS idx_products_selling_price ON public.products (selling_price);

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- Migration: 006_create_categories
-- Purpose: Menu categories scoped per restaurant for filtering and navigation.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) NOT NULL,
    description TEXT,
    image_url TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT categories_name_not_empty CHECK (char_length(trim(name)) > 0),
    CONSTRAINT categories_slug_not_empty CHECK (char_length(trim(slug)) > 0),
    CONSTRAINT categories_display_order_non_negative CHECK (display_order >= 0),

    CONSTRAINT fk_categories_restaurant_id
        FOREIGN KEY (restaurant_id)
        REFERENCES public.restaurants (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.categories IS
    'Product categories for menu organization. Scoped to restaurant for multi-tenant support.';

COMMENT ON COLUMN public.categories.display_order IS
    'Controls category sort order in customer menu UI.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_restaurant_slug_active
    ON public.categories (restaurant_id, slug)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_categories_restaurant_id ON public.categories (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_categories_name ON public.categories (name);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON public.categories (is_active);
CREATE INDEX IF NOT EXISTS idx_categories_display_order
    ON public.categories (restaurant_id, display_order);

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

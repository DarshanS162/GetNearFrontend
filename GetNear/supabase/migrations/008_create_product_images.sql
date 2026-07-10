-- ============================================================================
-- Migration: 008_create_product_images
-- Purpose: Multiple images per product stored in Supabase Storage.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    image_url TEXT NOT NULL,
    storage_path TEXT,
    alt_text VARCHAR(255),
    display_order INTEGER NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT product_images_url_not_empty CHECK (char_length(trim(image_url)) > 0),
    CONSTRAINT product_images_display_order_non_negative CHECK (display_order >= 0),

    CONSTRAINT fk_product_images_product_id
        FOREIGN KEY (product_id)
        REFERENCES public.products (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.product_images IS
    'Gallery images for products. Supports admin-managed media and CDN URLs.';

COMMENT ON COLUMN public.product_images.storage_path IS
    'Supabase Storage object path for image lifecycle management.';

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images (product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_display_order
    ON public.product_images (product_id, display_order);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_primary
    ON public.product_images (product_id)
    WHERE is_primary = TRUE;

DROP TRIGGER IF EXISTS trg_product_images_updated_at ON public.product_images;
CREATE TRIGGER trg_product_images_updated_at
    BEFORE UPDATE ON public.product_images
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

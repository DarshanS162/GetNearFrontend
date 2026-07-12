-- ============================================================================
-- Migration: 028_storage_buckets_and_policies
-- Purpose: Public buckets for restaurant banners and product photos.
--          Read: anyone. Write: see 029 (admin / owner only).
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'restaurant-assets',
    'restaurant-assets',
    TRUE,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'product-images',
    'product-images',
    TRUE,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  )
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read only (customers need to see images)
DROP POLICY IF EXISTS restaurant_assets_public_read ON storage.objects;
CREATE POLICY restaurant_assets_public_read
  ON storage.objects FOR SELECT
  USING (bucket_id = 'restaurant-assets');

DROP POLICY IF EXISTS product_images_public_read ON storage.objects;
CREATE POLICY product_images_public_read
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

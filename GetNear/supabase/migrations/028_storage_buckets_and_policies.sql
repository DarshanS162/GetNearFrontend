-- ============================================================================
-- Migration: 028_storage_buckets_and_policies
-- Purpose: Public buckets for restaurant banners and product photos.
--          Authenticated users can upload; anyone can read.
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

-- Public read
DROP POLICY IF EXISTS restaurant_assets_public_read ON storage.objects;
CREATE POLICY restaurant_assets_public_read
  ON storage.objects FOR SELECT
  USING (bucket_id = 'restaurant-assets');

DROP POLICY IF EXISTS product_images_public_read ON storage.objects;
CREATE POLICY product_images_public_read
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Authenticated upload
DROP POLICY IF EXISTS restaurant_assets_auth_upload ON storage.objects;
CREATE POLICY restaurant_assets_auth_upload
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'restaurant-assets');

DROP POLICY IF EXISTS product_images_auth_upload ON storage.objects;
CREATE POLICY product_images_auth_upload
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

-- Authenticated update / delete (replace images)
DROP POLICY IF EXISTS restaurant_assets_auth_update ON storage.objects;
CREATE POLICY restaurant_assets_auth_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'restaurant-assets');

DROP POLICY IF EXISTS product_images_auth_update ON storage.objects;
CREATE POLICY product_images_auth_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS restaurant_assets_auth_delete ON storage.objects;
CREATE POLICY restaurant_assets_auth_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'restaurant-assets');

DROP POLICY IF EXISTS product_images_auth_delete ON storage.objects;
CREATE POLICY product_images_auth_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images');

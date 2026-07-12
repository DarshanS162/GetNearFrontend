-- ============================================================================
-- Migration: 029_restrict_storage_and_user_update
-- Purpose:
--   1. Only admin / restaurant_owner can upload or change images
--   2. Remove dangerous users UPDATE policy (USING TRUE)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Storage: drop open "any authenticated" write policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS restaurant_assets_auth_upload ON storage.objects;
DROP POLICY IF EXISTS restaurant_assets_auth_update ON storage.objects;
DROP POLICY IF EXISTS restaurant_assets_auth_delete ON storage.objects;
DROP POLICY IF EXISTS product_images_auth_upload ON storage.objects;
DROP POLICY IF EXISTS product_images_auth_update ON storage.objects;
DROP POLICY IF EXISTS product_images_auth_delete ON storage.objects;

-- Restaurant banners: admin only (owners don't create restaurants)
CREATE POLICY restaurant_assets_admin_upload
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'restaurant-assets'
    AND public.is_admin()
  );

CREATE POLICY restaurant_assets_admin_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'restaurant-assets'
    AND public.is_admin()
  );

CREATE POLICY restaurant_assets_admin_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'restaurant-assets'
    AND public.is_admin()
  );

-- Menu photos: admin or restaurant owner
CREATE POLICY product_images_staff_upload
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (
      public.is_admin()
      OR public.current_role_slug() = 'restaurant_owner'
    )
  );

CREATE POLICY product_images_staff_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (
      public.is_admin()
      OR public.current_role_slug() = 'restaurant_owner'
    )
  );

CREATE POLICY product_images_staff_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (
      public.is_admin()
      OR public.current_role_slug() = 'restaurant_owner'
    )
  );

-- Keep public read (customer app needs to display images)
-- restaurant_assets_public_read / product_images_public_read unchanged

-- ---------------------------------------------------------------------------
-- users: remove open UPDATE policy
-- Profile linking uses SECURITY DEFINER RPCs (claim_user_by_phone, etc.)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS users_update_auth_link ON public.users;

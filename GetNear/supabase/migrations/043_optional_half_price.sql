-- ============================================================================
-- 043: Half price optional for full_half items (Full-only dishes allowed)
-- ============================================================================

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_pricing_values_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_pricing_values_check
  CHECK (
    (
      pricing_type = 'piece'
      AND selling_price IS NOT NULL
      AND selling_price >= 0
    )
    OR (
      pricing_type = 'full_half'
      AND full_price IS NOT NULL
      AND full_price >= 0
      AND (half_price IS NULL OR half_price >= 0)
    )
  );

COMMENT ON COLUMN public.products.half_price IS
  'Optional when pricing_type = full_half. NULL means Half is not available for this dish.';

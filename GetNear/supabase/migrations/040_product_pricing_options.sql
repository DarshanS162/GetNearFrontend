-- ============================================================================
-- 040: Product pricing types — Full/Half OR Piece (mutually exclusive)
-- ============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS pricing_type VARCHAR(20) NOT NULL DEFAULT 'piece',
  ADD COLUMN IF NOT EXISTS full_price DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS half_price DECIMAL(10, 2);

UPDATE public.products
SET pricing_type = 'piece'
WHERE pricing_type IS NULL OR pricing_type = '';

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_pricing_type_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_pricing_type_check
  CHECK (pricing_type IN ('full_half', 'piece'));

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
      AND half_price IS NOT NULL
      AND full_price >= 0
      AND half_price >= 0
    )
  );

COMMENT ON COLUMN public.products.pricing_type IS
  'full_half = Full + Half prices; piece = per-piece price (selling_price). Never both.';
COMMENT ON COLUMN public.products.full_price IS
  'Used when pricing_type = full_half. Independent of half_price.';
COMMENT ON COLUMN public.products.half_price IS
  'Used when pricing_type = full_half. Independent of full_price.';

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS pricing_option VARCHAR(20) NOT NULL DEFAULT 'piece';

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_pricing_option_check;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_pricing_option_check
  CHECK (pricing_option IN ('full', 'half', 'piece'));

COMMENT ON COLUMN public.order_items.pricing_option IS
  'Snapshot of selected price option: full, half, or piece.';

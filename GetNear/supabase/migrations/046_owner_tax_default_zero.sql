-- ============================================================================
-- 046: Tax is owner-controlled; default 0% (no tax until shop sets it)
-- ============================================================================

ALTER TABLE public.business_settings
  ALTER COLUMN tax_rate SET DEFAULT 0;

-- Old platform default was 5% — clear unless owner already customized
UPDATE public.business_settings
SET tax_rate = 0,
    updated_at = NOW()
WHERE tax_rate = 5.00;

COMMENT ON COLUMN public.business_settings.tax_rate IS
  'Order-level tax percent (e.g. 5 = 5%). Default 0 — no tax until the shop owner sets it.';

CREATE OR REPLACE FUNCTION public.get_restaurant_tax_rate(p_restaurant_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (
      SELECT bs.tax_rate / 100.0
      FROM public.business_settings bs
      WHERE bs.restaurant_id = p_restaurant_id
      LIMIT 1
    ),
    0
  );
$$;

ALTER FUNCTION public.get_restaurant_tax_rate(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_restaurant_tax_rate(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_restaurant_tax_rate(uuid) TO authenticated, anon;

-- Owner sets tax percent (0–100). Creates business_settings row if needed.
CREATE OR REPLACE FUNCTION public.set_restaurant_tax_rate(
  p_restaurant_id uuid,
  p_tax_percent numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate numeric;
BEGIN
  IF p_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Restaurant is required';
  END IF;

  IF NOT public.is_admin()
     AND NOT public.is_restaurant_owner_of(p_restaurant_id) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  v_rate := coalesce(p_tax_percent, 0);
  IF v_rate < 0 OR v_rate > 100 THEN
    RAISE EXCEPTION 'Tax rate must be between 0 and 100';
  END IF;

  INSERT INTO public.business_settings (restaurant_id, tax_rate)
  VALUES (p_restaurant_id, v_rate)
  ON CONFLICT (restaurant_id)
  DO UPDATE SET
    tax_rate = EXCLUDED.tax_rate,
    updated_at = NOW();

  RETURN v_rate;
END;
$$;

ALTER FUNCTION public.set_restaurant_tax_rate(uuid, numeric) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_restaurant_tax_rate(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_restaurant_tax_rate(uuid, numeric) TO authenticated;

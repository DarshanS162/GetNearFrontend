-- ============================================================================
-- 037: Harden order flow — status machine RPC, PIN secrecy, customer cancel-only
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Stronger order numbers (sequence-backed)
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq;

CREATE OR REPLACE FUNCTION public.next_order_number(p_prefix text DEFAULT 'GN')
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_n bigint;
  v_day text := to_char(timezone('Asia/Kolkata', now()), 'YYYYMMDD');
BEGIN
  v_n := nextval('public.order_number_seq');
  RETURN upper(coalesce(nullif(trim(p_prefix), ''), 'GN'))
    || '-' || v_day || '-' || lpad((v_n % 1000000)::text, 6, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_order_number(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_order_number(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.orders_fill_order_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix text := 'GN';
BEGIN
  IF NEW.order_number IS NULL OR btrim(NEW.order_number) = '' THEN
    SELECT coalesce(nullif(trim(bs.order_prefix), ''), 'GN')
      INTO v_prefix
    FROM public.business_settings bs
    WHERE bs.restaurant_id = NEW.restaurant_id
    LIMIT 1;

    NEW.order_number := public.next_order_number(v_prefix);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_fill_order_number ON public.orders;
CREATE TRIGGER trg_orders_fill_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_fill_order_number();

-- ---------------------------------------------------------------------------
-- 2) Status transition helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_status_can_transition(p_from text, p_to text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_from
    WHEN 'placed' THEN p_to IN ('confirmed', 'cancelled')
    WHEN 'confirmed' THEN p_to IN ('preparing', 'cancelled')
    WHEN 'preparing' THEN p_to IN ('out_for_delivery', 'cancelled')
    WHEN 'ready' THEN p_to IN ('out_for_delivery', 'cancelled')
    WHEN 'out_for_delivery' THEN p_to = 'delivered'
    ELSE FALSE
  END;
$$;

-- ---------------------------------------------------------------------------
-- 3) Secure status transitions via RPC only (no GUC guard trigger — unreliable
--    with SECURITY DEFINER on Supabase). UPDATE privilege revoked in 038.
-- ---------------------------------------------------------------------------
-- (placeholder kept for migration numbering continuity)

CREATE OR REPLACE FUNCTION public.advance_order_status(
  p_order_id uuid,
  p_next_status text,
  p_cancelled_reason text DEFAULT NULL,
  p_delivery_pin text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders;
  v_pin text;
BEGIN
  IF p_order_id IS NULL OR p_next_status IS NULL THEN
    RAISE EXCEPTION 'Order id and status are required';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF NOT (
    public.is_admin()
    OR public.is_restaurant_owner_of(v_order.restaurant_id)
  ) THEN
    RAISE EXCEPTION 'Not allowed to update this order';
  END IF;

  IF NOT public.order_status_can_transition(v_order.order_status, p_next_status) THEN
    RAISE EXCEPTION 'Cannot move order from % to %', v_order.order_status, p_next_status;
  END IF;

  IF p_next_status = 'cancelled' THEN
    v_order.cancelled_reason := coalesce(
      nullif(trim(p_cancelled_reason), ''),
      'Cancelled by restaurant'
    );
  END IF;

  IF p_next_status = 'confirmed' AND v_order.delivery_pin IS NULL THEN
    v_order.delivery_pin := lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
  END IF;

  IF p_next_status = 'delivered' THEN
    v_pin := v_order.delivery_pin;
    IF v_pin IS NULL OR v_pin !~ '^[0-9]{4}$' THEN
      RAISE EXCEPTION 'Delivery code is missing for this order';
    END IF;
    IF coalesce(trim(p_delivery_pin), '') !~ '^[0-9]{4}$' THEN
      RAISE EXCEPTION 'Enter the 4-digit delivery code from the customer';
    END IF;
    IF trim(p_delivery_pin) IS DISTINCT FROM v_pin THEN
      RAISE EXCEPTION 'Delivery code does not match. Ask the customer again.';
    END IF;
    IF v_order.payment_method = 'cod' THEN
      v_order.payment_status := 'paid';
    END IF;
  END IF;

  UPDATE public.orders o
  SET
    order_status = p_next_status,
    cancelled_reason = CASE
      WHEN p_next_status = 'cancelled' THEN v_order.cancelled_reason
      ELSE o.cancelled_reason
    END,
    delivery_pin = v_order.delivery_pin,
    payment_status = v_order.payment_status,
    updated_at = now()
  WHERE o.id = p_order_id;

  RETURN p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_order_status(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_order_status(uuid, text, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Customer cancel only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_cancel_order(
  p_order_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders;
  v_uid uuid := public.current_app_user_id();
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.customer_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Not allowed to cancel this order';
  END IF;

  IF v_order.order_status NOT IN ('placed', 'confirmed') THEN
    RAISE EXCEPTION 'This order can no longer be cancelled';
  END IF;

  UPDATE public.orders
  SET
    order_status = 'cancelled',
    cancelled_reason = coalesce(nullif(trim(p_reason), ''), 'Cancelled by customer'),
    updated_at = now()
  WHERE id = p_order_id;

  RETURN p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.customer_cancel_order(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_cancel_order(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) Customer-only PIN fetch
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_order_delivery_pin(p_order_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_pin text;
  v_customer uuid;
  v_status text;
BEGIN
  SELECT delivery_pin, customer_id, order_status
    INTO v_pin, v_customer, v_status
  FROM public.orders
  WHERE id = p_order_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_customer IS DISTINCT FROM public.current_app_user_id()
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF v_status IN ('cancelled', 'delivered', 'placed') THEN
    RETURN NULL;
  END IF;

  RETURN v_pin;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_order_delivery_pin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_order_delivery_pin(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7) Tighten customer UPDATE RLS — owners/admins only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS orders_update_owner_admin ON public.orders;

CREATE POLICY orders_update_owner_admin ON public.orders
  FOR UPDATE
  USING (
    public.is_admin()
    OR public.is_restaurant_owner_of(restaurant_id)
  )
  WITH CHECK (
    public.is_admin()
    OR public.is_restaurant_owner_of(restaurant_id)
  );

-- ---------------------------------------------------------------------------
-- 8) Cart pricing helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quote_delivery_charge(
  p_restaurant_id uuid,
  p_subtotal numeric
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charge numeric;
BEGIN
  SELECT
    CASE
      WHEN dc.is_free_delivery THEN 0
      ELSE dc.charge_amount
    END
  INTO v_charge
  FROM public.delivery_charges dc
  WHERE dc.restaurant_id = p_restaurant_id
    AND dc.deleted_at IS NULL
    AND dc.is_active = TRUE
    AND p_subtotal >= dc.min_order_amount
    AND (dc.max_order_amount IS NULL OR p_subtotal <= dc.max_order_amount)
  ORDER BY dc.min_order_amount DESC
  LIMIT 1;

  RETURN coalesce(v_charge, 22);
END;
$$;

REVOKE ALL ON FUNCTION public.quote_delivery_charge(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quote_delivery_charge(uuid, numeric) TO authenticated, anon;

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
    0.05
  );
$$;

REVOKE ALL ON FUNCTION public.get_restaurant_tax_rate(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_restaurant_tax_rate(uuid) TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- 9) PIN column secrecy
-- ---------------------------------------------------------------------------
REVOKE SELECT (delivery_pin) ON public.orders FROM PUBLIC;
REVOKE SELECT (delivery_pin) ON public.orders FROM anon;
REVOKE SELECT (delivery_pin) ON public.orders FROM authenticated;

COMMENT ON FUNCTION public.get_my_order_delivery_pin(uuid) IS
  'Returns handover PIN only to the order customer (or admin).';

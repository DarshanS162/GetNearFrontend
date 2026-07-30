-- ============================================================================
-- 038: Fix owner status updates blocked by order_status guard trigger
-- The GUC-based guard was rejecting SECURITY DEFINER RPC updates in practice.
-- Prefer UPDATE revoke so only RPCs (table owner / SECURITY DEFINER) can change rows.
-- ============================================================================

-- Remove brittle GUC guard
DROP TRIGGER IF EXISTS trg_orders_guard_status_update ON public.orders;
DROP FUNCTION IF EXISTS public.orders_guard_status_update();

-- Transition helper (safe if 037 partially applied)
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

-- Clients must not UPDATE orders directly — use advance_order_status / customer_cancel_order.
REVOKE UPDATE ON TABLE public.orders FROM PUBLIC;
REVOKE UPDATE ON TABLE public.orders FROM anon;
REVOKE UPDATE ON TABLE public.orders FROM authenticated;

-- Ensure advance_order_status is present and returns uuid (no PIN leak)
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

-- Keep SELECT + INSERT for placing/listing orders; UPDATE only via RPC
GRANT SELECT, INSERT ON TABLE public.orders TO authenticated;

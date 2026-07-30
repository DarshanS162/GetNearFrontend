-- ============================================================================
-- 039: Enforce Rapido-style delivery code — cannot mark delivered without verified PIN
-- ============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_verified_at timestamptz;

COMMENT ON COLUMN public.orders.delivery_verified_at IS
  'Set only by advance_order_status after customer handover PIN matches.';

-- Clients must not forge verification timestamp
REVOKE UPDATE (delivery_verified_at) ON public.orders FROM PUBLIC;
REVOKE UPDATE (delivery_verified_at) ON public.orders FROM anon;
REVOKE UPDATE (delivery_verified_at) ON public.orders FROM authenticated;

-- Block any path that sets delivered without verification timestamp
CREATE OR REPLACE FUNCTION public.orders_require_delivery_verification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_status = 'delivered'
     AND (OLD.order_status IS DISTINCT FROM 'delivered')
     AND NEW.delivery_verified_at IS NULL
  THEN
    RAISE EXCEPTION 'Enter the customer delivery code to complete this order';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_require_delivery_verification ON public.orders;
CREATE TRIGGER trg_orders_require_delivery_verification
  BEFORE UPDATE OF order_status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_require_delivery_verification();

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
  v_provided text;
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

  -- Ensure PIN exists once order is confirmed / in kitchen / out
  IF p_next_status IN ('confirmed', 'preparing', 'out_for_delivery')
     AND v_order.delivery_pin IS NULL
  THEN
    v_order.delivery_pin := lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
  END IF;

  IF p_next_status = 'delivered' THEN
    v_pin := trim(coalesce(v_order.delivery_pin, ''));
    v_provided := trim(coalesce(p_delivery_pin, ''));

    IF v_pin !~ '^[0-9]{4}$' THEN
      -- Last-chance generate only blocks deliver — pin must already exist
      RAISE EXCEPTION 'Delivery code was not generated. Confirm the order again or contact support.';
    END IF;

    IF v_provided !~ '^[0-9]{4}$' THEN
      RAISE EXCEPTION 'Enter the 4-digit delivery code from the customer';
    END IF;

    IF v_provided IS DISTINCT FROM v_pin THEN
      RAISE EXCEPTION 'Delivery code does not match. Ask the customer again.';
    END IF;

    v_order.delivery_verified_at := now();

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
    delivery_verified_at = CASE
      WHEN p_next_status = 'delivered' THEN v_order.delivery_verified_at
      ELSE o.delivery_verified_at
    END,
    payment_status = v_order.payment_status,
    updated_at = now()
  WHERE o.id = p_order_id;

  RETURN p_order_id;
END;
$$;

ALTER FUNCTION public.advance_order_status(uuid, text, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.advance_order_status(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_order_status(uuid, text, text, text) TO authenticated;

-- Customer PIN fetch (harden owner)
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

ALTER FUNCTION public.get_my_order_delivery_pin(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_my_order_delivery_pin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_order_delivery_pin(uuid) TO authenticated;

-- Keep working privileges for place + list + RPC FOR UPDATE
GRANT SELECT, INSERT, UPDATE ON TABLE public.orders TO authenticated;
GRANT ALL ON TABLE public.orders TO postgres;
GRANT ALL ON TABLE public.orders TO service_role;
-- Still block forging verification via column privilege
REVOKE UPDATE (delivery_verified_at) ON public.orders FROM authenticated;
REVOKE UPDATE (delivery_verified_at) ON public.orders FROM anon;

-- Backfill PIN for active orders missing one
UPDATE public.orders
SET delivery_pin = lpad((floor(random() * 9000) + 1000)::int::text, 4, '0')
WHERE deleted_at IS NULL
  AND delivery_pin IS NULL
  AND order_status IN ('confirmed', 'preparing', 'ready', 'out_for_delivery');

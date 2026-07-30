-- 4-digit delivery PIN: generated when restaurant confirms the order.
-- Customer shares this with the delivery partner at handover.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_pin text;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_delivery_pin_format;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_pin_format
  CHECK (
    delivery_pin IS NULL
    OR delivery_pin ~ '^[0-9]{4}$'
  );

COMMENT ON COLUMN public.orders.delivery_pin IS
  '4-digit handover code shown to customer after confirmation; told to delivery partner on receipt.';

CREATE OR REPLACE FUNCTION public.orders_assign_delivery_pin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create PIN once when order is confirmed (or backfill if still missing later).
  IF NEW.delivery_pin IS NULL
     AND NEW.order_status IN (
       'confirmed',
       'preparing',
       'ready',
       'out_for_delivery'
     )
  THEN
    NEW.delivery_pin := lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_assign_delivery_pin ON public.orders;

CREATE TRIGGER trg_orders_assign_delivery_pin
  BEFORE INSERT OR UPDATE OF order_status
  ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_assign_delivery_pin();

-- Backfill active orders that are already past placed and have no pin.
UPDATE public.orders
SET order_status = order_status
WHERE deleted_at IS NULL
  AND delivery_pin IS NULL
  AND order_status IN ('confirmed', 'preparing', 'ready', 'out_for_delivery');

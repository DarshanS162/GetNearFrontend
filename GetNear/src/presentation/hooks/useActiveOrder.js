import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { orderUseCases } from '../../application/container';
import { isActiveOrderStatus } from '../../domain/orderStatus';

export const ORDERS_CHANGED_EVENT = 'getnear:orders-changed';

export function notifyOrdersChanged() {
  window.dispatchEvent(new Event(ORDERS_CHANGED_EVENT));
}

/**
 * Latest in-progress customer order (placed → out for delivery).
 */
export function useActiveOrder({ enabled = true } = {}) {
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState(null);

  const refresh = useCallback(async () => {
    if (!enabled || authLoading || !user?.id) {
      setOrder(null);
      return null;
    }
    try {
      const rows = await orderUseCases.listForCustomer.execute(user.id);
      const active = (rows || []).find((o) =>
        isActiveOrderStatus(o.orderStatus),
      );
      setOrder(active || null);
      return active || null;
    } catch {
      setOrder(null);
      return null;
    }
  }, [enabled, authLoading, user?.id]);

  useEffect(() => {
    if (!enabled || authLoading || !user?.id) {
      setOrder(null);
      return undefined;
    }

    refresh();
    const timer = setInterval(refresh, 20000);
    const onFocus = () => refresh();
    const onChanged = () => refresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener(ORDERS_CHANGED_EVENT, onChanged);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(ORDERS_CHANGED_EVENT, onChanged);
    };
  }, [enabled, authLoading, user?.id, refresh]);

  return {
    activeOrder: order,
    hasActiveOrder: Boolean(order),
    refresh,
  };
}

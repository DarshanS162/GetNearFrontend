import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { orderUseCases } from '../../application/container';
import {
  ORDER_STATUS_LABELS,
  isActiveOrderStatus,
} from '../../domain/orderStatus';
import { IconBike, IconChevron } from '../ui/Icons';
import './ActiveOrderFab.css';

const HIDE_PREFIXES = ['/admin', '/owner', '/login', '/signup', '/otp', '/set-password', '/partner'];

function shouldHide(pathname) {
  if (HIDE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  // Already on tracking for any order
  if (pathname.startsWith('/order/')) return true;
  return false;
}

/**
 * Floating card for the customer's latest in-progress order.
 */
export default function ActiveOrderFab() {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [order, setOrder] = useState(null);

  const hidden = shouldHide(location.pathname);

  useEffect(() => {
    if (authLoading || !user?.id || hidden) {
      setOrder(null);
      return undefined;
    }

    let cancelled = false;

    async function load() {
      try {
        const rows = await orderUseCases.listForCustomer.execute(user.id);
        if (cancelled) return;
        const active = (rows || []).find((o) =>
          isActiveOrderStatus(o.orderStatus),
        );
        setOrder(active || null);
      } catch {
        if (!cancelled) setOrder(null);
      }
    }

    load();
    const timer = setInterval(load, 20000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.id, authLoading, hidden, location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('has-active-order-fab', Boolean(order) && !hidden);
    return () => document.body.classList.remove('has-active-order-fab');
  }, [order, hidden]);

  if (hidden || !order) return null;

  const statusLabel =
    ORDER_STATUS_LABELS[order.orderStatus] || order.orderStatus;
  const itemCount = order.items?.length || 0;

  return (
    <Link
      to={`/order/${order.id}`}
      className="active-order-fab"
      aria-label={`Track order ${order.orderNumber}, ${statusLabel}`}
    >
      <span className="active-order-fab-icon" aria-hidden="true">
        <IconBike size={18} />
      </span>
      <span className="active-order-fab-copy">
        <strong>{statusLabel}</strong>
        <span>
          {order.restaurantName || 'Your order'}
          {itemCount > 0
            ? ` · ${itemCount} item${itemCount === 1 ? '' : 's'}`
            : ''}
        </span>
      </span>
      <span className="active-order-fab-action">
        Track
        <IconChevron size={14} />
      </span>
    </Link>
  );
}

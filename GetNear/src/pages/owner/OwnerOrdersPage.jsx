import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { orderUseCases } from '../../application/container';
import { supabase } from '../../lib/supabase';
import {
  ORDER_STATUS,
  ORDER_STATUS_LABELS,
  nextOwnerStatuses,
} from '../../domain/orderStatus';
import '../admin/AdminLayout.css';
import './OwnerLayout.css';

const ACTIVE_STATUSES = new Set([
  ORDER_STATUS.PLACED,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY,
  ORDER_STATUS.OUT_FOR_DELIVERY,
]);

function normalizeStatus(status) {
  return String(status || '').trim().toLowerCase();
}

function formatOrderTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function OwnerOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState('');
  const [pinDrafts, setPinDrafts] = useState({});
  const [pinErrors, setPinErrors] = useState({});
  const [cancelDraft, setCancelDraft] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [tab, setTab] = useState('active');

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!user?.restaurantId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    if (!quiet) setLoading(true);
    setError('');
    try {
      const rows = await orderUseCases.listForRestaurant.execute(user.restaurantId);
      setOrders(rows);
    } catch (err) {
      setError(err.message || 'Failed to load orders');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [user?.restaurantId]);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => refresh({ quiet: true }), 20000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!user?.restaurantId) return undefined;

    const channel = supabase
      .channel(`owner-orders-${user.restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${user.restaurantId}`,
        },
        () => {
          refresh({ quiet: true });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.restaurantId, refresh]);

  const { activeCount, completedCount, visibleOrders } = useMemo(() => {
    const active = [];
    const completed = [];
    for (const order of orders) {
      const status = normalizeStatus(order.orderStatus);
      if (
        status === ORDER_STATUS.DELIVERED ||
        status === ORDER_STATUS.CANCELLED
      ) {
        completed.push(order);
      } else if (ACTIVE_STATUSES.has(status)) {
        active.push(order);
      }
    }
    return {
      activeCount: active.length,
      completedCount: completed.length,
      visibleOrders: tab === 'completed' ? completed : active,
    };
  }, [orders, tab]);

  async function handleStatus(orderId, nextStatus, extras = {}) {
    setUpdatingId(orderId);
    setError('');
    setPinErrors((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });

    try {
      await orderUseCases.updateStatus.execute({
        orderId,
        nextStatus,
        deliveryPin: extras.deliveryPin || '',
        cancelledReason: extras.cancelledReason || '',
      });
      setPinDrafts((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      setCancelDraft(null);
      setCancelReason('');
      await refresh({ quiet: true });
    } catch (err) {
      const msg = err.message || 'Could not update status';
      if (nextStatus === ORDER_STATUS.DELIVERED) {
        setPinErrors((prev) => ({ ...prev, [orderId]: msg }));
      }
      setError(msg);
    } finally {
      setUpdatingId('');
    }
  }

  function onStatusClick(orderId, status) {
    if (status === ORDER_STATUS.CANCELLED) {
      setCancelDraft({ orderId });
      setCancelReason('');
      return;
    }
    handleStatus(orderId, status);
  }

  async function submitDeliveryCode(orderId, currentStatus) {
    const pin = String(pinDrafts[orderId] || '').trim();
    if (!/^\d{4}$/.test(pin)) {
      setPinErrors((prev) => ({
        ...prev,
        [orderId]: 'Enter 4-digit code',
      }));
      return;
    }

    const status = normalizeStatus(currentStatus);
    setUpdatingId(orderId);
    setError('');
    setPinErrors((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });

    try {
      if (status === ORDER_STATUS.PREPARING || status === ORDER_STATUS.READY) {
        await orderUseCases.updateStatus.execute({
          orderId,
          nextStatus: ORDER_STATUS.OUT_FOR_DELIVERY,
          deliveryPin: '',
        });
      }

      await orderUseCases.updateStatus.execute({
        orderId,
        nextStatus: ORDER_STATUS.DELIVERED,
        deliveryPin: pin,
      });

      setPinDrafts((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      await refresh({ quiet: true });
    } catch (err) {
      const msg = err.message || 'Could not complete delivery';
      setPinErrors((prev) => ({ ...prev, [orderId]: msg }));
      setError(msg);
      await refresh({ quiet: true });
    } finally {
      setUpdatingId('');
    }
  }

  if (!user?.restaurantId) {
    return (
      <div className="oo">
        <h1 className="oo-title">Orders</h1>
        <p className="oo-muted">No restaurant linked to this account.</p>
      </div>
    );
  }

  return (
    <div className="oo">
      <div className="oo-head">
        <h1 className="oo-title">Orders</h1>
        <div className="oo-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className={tab === 'active' ? 'is-on' : ''}
            onClick={() => setTab('active')}
          >
            Active ({activeCount})
          </button>
          <button
            type="button"
            role="tab"
            className={tab === 'completed' ? 'is-on' : ''}
            onClick={() => setTab('completed')}
          >
            Done ({completedCount})
          </button>
        </div>
      </div>

      {error && <div className="owner-alert owner-alert--danger">{error}</div>}
      {loading && <p className="oo-muted">Loading…</p>}

      {!loading && visibleOrders.length === 0 && (
        <p className="oo-muted">
          {tab === 'active' ? 'No active orders.' : 'No completed orders yet.'}
        </p>
      )}

      <div className="oo-list">
        {visibleOrders.map((order) => {
          const status = normalizeStatus(order.orderStatus);
          const showCode =
            status === ORDER_STATUS.PREPARING ||
            status === ORDER_STATUS.READY ||
            status === ORDER_STATUS.OUT_FOR_DELIVERY;
          const pinValue = String(pinDrafts[order.id] || '');
          const pinReady = /^\d{4}$/.test(pinValue);
          const items = Array.isArray(order.items) ? order.items : [];
          const next = nextOwnerStatuses(status).filter(
            (s) => s !== ORDER_STATUS.DELIVERED,
          );
          const primary = next.find((s) => s !== ORDER_STATUS.CANCELLED);
          const canCancel = next.includes(ORDER_STATUS.CANCELLED);

          return (
            <article key={order.id} className="oo-card card">
              <header className="oo-top">
                <div className="oo-top-left">
                  <strong className="oo-num">#{order.orderNumber}</strong>
                  <span className="oo-meta">
                    {formatOrderTime(order.placedAt)} · COD
                  </span>
                </div>
                <div className="oo-top-right">
                  <span className={`oo-status oo-status--${status}`}>
                    {ORDER_STATUS_LABELS[status] || status}
                  </span>
                  <strong className="oo-amt">₹{order.grandTotal}</strong>
                </div>
              </header>

              <ul className="oo-items">
                {items.map((item) => (
                  <li key={item.id}>
                    <span>
                      <span className="oo-qty">{item.quantity}</span>
                      {item.productName}
                    </span>
                    <span className="oo-item-price">₹{item.totalPrice}</span>
                  </li>
                ))}
              </ul>

              {order.addressLine && (
                <p className="oo-addr">
                  {order.address?.fullName ? `${order.address.fullName} · ` : ''}
                  {order.addressLine}
                </p>
              )}

              {showCode && (
                <div className="oo-code">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                    aria-label="Delivery code"
                    value={pinValue}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setPinDrafts((prev) => ({ ...prev, [order.id]: value }));
                      setPinErrors((prev) => {
                        const nextErr = { ...prev };
                        delete nextErr[order.id];
                        return nextErr;
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        submitDeliveryCode(order.id, status);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={updatingId === order.id || !pinReady}
                    onClick={() => submitDeliveryCode(order.id, status)}
                  >
                    {updatingId === order.id ? '…' : 'Deliver'}
                  </button>
                  {pinErrors[order.id] && (
                    <span className="oo-err">{pinErrors[order.id]}</span>
                  )}
                </div>
              )}

              {cancelDraft?.orderId === order.id ? (
                <div className="oo-cancel">
                  <input
                    className="form-input"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Cancel reason"
                    maxLength={120}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      setCancelDraft(null);
                      setCancelReason('');
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={updatingId === order.id || !cancelReason.trim()}
                    onClick={() =>
                      handleStatus(order.id, ORDER_STATUS.CANCELLED, {
                        cancelledReason: cancelReason.trim(),
                      })
                    }
                  >
                    Confirm
                  </button>
                </div>
              ) : (
                (primary || canCancel) && (
                  <div className="oo-actions">
                    {primary && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={updatingId === order.id}
                        onClick={() => onStatusClick(order.id, primary)}
                      >
                        {ORDER_STATUS_LABELS[primary]}
                      </button>
                    )}
                    {canCancel && (
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        disabled={updatingId === order.id}
                        onClick={() =>
                          onStatusClick(order.id, ORDER_STATUS.CANCELLED)
                        }
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                )
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

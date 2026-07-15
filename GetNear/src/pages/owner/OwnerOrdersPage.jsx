import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { orderUseCases } from '../../application/container';
import {
  ORDER_STATUS_LABELS,
  nextOwnerStatuses,
} from '../../domain/orderStatus';
import '../admin/AdminLayout.css';

export default function OwnerOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState('');

  const refresh = useCallback(async () => {
    if (!user?.restaurantId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const rows = await orderUseCases.listForRestaurant.execute(user.restaurantId);
      setOrders(rows);
    } catch (err) {
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [user?.restaurantId]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 20000);
    return () => clearInterval(timer);
  }, [refresh]);

  async function handleStatus(orderId, nextStatus) {
    setUpdatingId(orderId);
    setError('');
    try {
      await orderUseCases.updateStatus.execute({ orderId, nextStatus });
      await refresh();
    } catch (err) {
      setError(err.message || 'Could not update status');
    } finally {
      setUpdatingId('');
    }
  }

  if (!user?.restaurantId) {
    return (
      <div className="admin-page-header">
        <h1>Orders</h1>
        <p>No restaurant linked to this account.</p>
      </div>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1>Orders</h1>
        <p>Incoming orders for your restaurant. Refreshes every 20s.</p>
      </div>

      {error && (
        <div className="card" style={{ padding: 16, marginBottom: 16, color: '#ef4444' }}>
          {error}
        </div>
      )}

      {loading && <p style={{ color: 'var(--color-text-secondary)' }}>Loading orders…</p>}

      {!loading && orders.length === 0 && (
        <div className="card" style={{ padding: 24 }}>
          <p style={{ margin: 0 }}>No orders yet. They will show up here when customers place COD orders.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {orders.map((order) => {
          const next = nextOwnerStatuses(order.orderStatus);
          return (
            <div key={order.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                <strong>{order.orderNumber}</strong>
                <span style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: 13 }}>
                  {ORDER_STATUS_LABELS[order.orderStatus]}
                </span>
              </div>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                {new Date(order.placedAt).toLocaleString()} · ₹{order.grandTotal} · COD
              </p>
              <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 14 }}>
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.quantity}× {item.productName}
                  </li>
                ))}
              </ul>
              {order.addressLine && (
                <p style={{ margin: '0 0 12px', fontSize: 13 }}>
                  Deliver to: {order.address?.fullName} — {order.addressLine}
                </p>
              )}
              {next.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {next.map((status) => (
                    <button
                      key={status}
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={updatingId === order.id}
                      onClick={() => handleStatus(order.id, status)}
                    >
                      Mark {ORDER_STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

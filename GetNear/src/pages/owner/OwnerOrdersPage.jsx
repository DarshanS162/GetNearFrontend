import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { orderUseCases } from '../../application/container';
import {
  ORDER_STATUS_LABELS,
  nextOwnerStatuses,
} from '../../domain/orderStatus';
import '../admin/AdminLayout.css';
import './OwnerLayout.css';

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
        <p>Incoming orders refresh every 20 seconds.</p>
      </div>

      {error && <div className="owner-alert owner-alert--danger">{error}</div>}

      {loading && <p className="owner-muted">Loading orders…</p>}

      {!loading && orders.length === 0 && (
        <div className="owner-empty card">
          <strong>No orders yet</strong>
          <p>New COD orders will appear here automatically.</p>
        </div>
      )}

      <div className="owner-orders-list">
        {orders.map((order) => {
          const next = nextOwnerStatuses(order.orderStatus);
          return (
            <article key={order.id} className="card owner-order-card">
              <div className="owner-order-card-top">
                <div>
                  <strong className="owner-order-number">{order.orderNumber}</strong>
                  <p className="owner-order-meta">
                    {new Date(order.placedAt).toLocaleString()} · COD
                  </p>
                </div>
                <div className="owner-order-side">
                  <span className="owner-order-status">
                    {ORDER_STATUS_LABELS[order.orderStatus]}
                  </span>
                  <span className="owner-order-amount">₹{order.grandTotal}</span>
                </div>
              </div>

              <ul className="owner-order-items">
                {order.items.map((item) => (
                  <li key={item.id}>
                    <span>
                      {item.quantity}× {item.productName}
                    </span>
                    <span>₹{item.totalPrice}</span>
                  </li>
                ))}
              </ul>

              {order.addressLine && (
                <p className="owner-order-address">
                  <span className="owner-order-address-label">Deliver to</span>
                  {order.address?.fullName} — {order.addressLine}
                </p>
              )}

              {next.length > 0 && (
                <div className="owner-order-actions">
                  {next.map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`btn btn-sm ${
                        status === 'cancelled' ? 'btn-secondary' : 'btn-primary'
                      }`}
                      disabled={updatingId === order.id}
                      onClick={() => handleStatus(order.id, status)}
                    >
                      Mark {ORDER_STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}

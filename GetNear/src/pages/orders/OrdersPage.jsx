import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar';
import { RequireAuth } from '../../components/auth/RequireAuth';
import { IconBack } from '../../components/ui/Icons';
import { useAuth } from '../../context/AuthContext';
import { orderUseCases } from '../../application/container';
import './OrdersPage.css';

function OrdersPageInner() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await orderUseCases.listForCustomer.execute(user.id);
        if (!cancelled) setOrders(rows);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load orders');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  return (
    <div className="app-shell animate-in">
      <Navbar showLocation={false} />
      <main className="page-container orders-page">
        <div className="page-header">
          <Link to="/profile" className="back-btn" aria-label="Go back">
            <IconBack />
          </Link>
          <h1>Your orders</h1>
        </div>

        {loading && <p className="muted">Loading orders…</p>}
        {error && <p className="form-error">{error}</p>}

        {!loading && orders.length === 0 && (
          <div className="empty-state card">
            <p>No orders yet.</p>
            <Link to="/" className="btn btn-primary" style={{ marginTop: 12 }}>
              Order something nearby
            </Link>
          </div>
        )}

        <div className="orders-list">
          {orders.map((order) => (
            <Link key={order.id} to={`/order/${order.id}`} className="order-card card">
              <div className="order-card-top">
                <strong>{order.orderNumber}</strong>
                <span className="order-status">{order.statusLabel}</span>
              </div>
              <p className="order-meta">
                {order.restaurantName || 'Restaurant'} · {order.items.length} item
                {order.items.length === 1 ? '' : 's'}
              </p>
              <div className="order-card-bottom">
                <span>₹{order.grandTotal}</span>
                <span className="order-date">
                  {order.placedAt
                    ? new Date(order.placedAt).toLocaleString()
                    : ''}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <RequireAuth>
      <OrdersPageInner />
    </RequireAuth>
  );
}

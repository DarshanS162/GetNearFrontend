import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { IconBack, IconCheck } from '../../components/ui/Icons';
import { RequireAuth } from '../../components/auth/RequireAuth';
import { orderUseCases } from '../../application/container';
import {
  ORDER_STATUS,
  ORDER_STATUS_LABELS,
  ORDER_TIMELINE,
  getTimelineIndex,
} from '../../domain/orderStatus';
import { formatAddressLine } from '../../domain/address';
import './OrderTrackingPage.css';

function OrderTrackingInner() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let timer;

    async function load() {
      try {
        let result = null;
        if (String(id || '').startsWith('GN-')) {
          result = await orderUseCases.get.execute({ orderNumber: id });
        } else {
          result = await orderUseCases.get.execute({ id });
          if (!result) {
            result = await orderUseCases.get.execute({ orderNumber: id });
          }
        }

        if (!cancelled) {
          setOrder(result);
          setError(result ? '' : 'Order not found');
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load order');
          setLoading(false);
        }
      }
    }

    load();
    timer = setInterval(load, 15000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id]);

  if (loading) {
    return (
      <div className="app-shell animate-in">
        <main className="page-container tracking-page">
          <p style={{ color: 'var(--color-text-secondary)' }}>Loading order…</p>
        </main>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="app-shell animate-in">
        <main className="page-container tracking-page">
          <div className="page-header">
            <Link to="/orders" className="back-btn" aria-label="Go back">
              <IconBack />
            </Link>
            <h1>Order</h1>
          </div>
          <div className="empty-state card">
            <p>{error || 'Order not found'}</p>
            <Link to="/orders" className="btn btn-primary" style={{ marginTop: 12 }}>
              View orders
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const cancelled = order.orderStatus === ORDER_STATUS.CANCELLED;
  const activeIndex = getTimelineIndex(order.orderStatus);

  return (
    <div className="app-shell animate-in">
      <main className="page-container tracking-page">
        <div className="page-header">
          <Link to="/orders" className="back-btn" aria-label="Go back">
            <IconBack />
          </Link>
          <h1>Order #{order.orderNumber}</h1>
        </div>

        <div className="status-banner card">
          <strong>
            {cancelled
              ? 'Cancelled'
              : ORDER_STATUS_LABELS[order.orderStatus] || order.orderStatus}
          </strong>
          <span>
            {cancelled
              ? order.cancelledReason || 'This order was cancelled'
              : order.restaurantName || 'Your order is on the way'}
          </span>
        </div>

        {!cancelled && (
          <div className="timeline card">
            {ORDER_TIMELINE.map((status, index) => {
              let state = '';
              if (index < activeIndex) state = 'done';
              else if (index === activeIndex) state = 'active';

              return (
                <div key={status} className={`timeline-step ${state}`}>
                  <div className="timeline-dot">
                    {state === 'done' ? <IconCheck /> : index + 1}
                  </div>
                  <span className="timeline-label">
                    {ORDER_STATUS_LABELS[status]}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="tracking-details card">
          <p className="section-label">ITEMS</p>
          {order.items.map((item) => (
            <div key={item.id} className="tracking-item-row">
              <span>
                {item.quantity}× {item.productName}
              </span>
              <span>₹{item.totalPrice}</span>
            </div>
          ))}
          <div className="divider-dashed" />
          <div className="tracking-item-row tracking-total">
            <span>Total ({order.paymentMethod.toUpperCase()})</span>
            <span>₹{order.grandTotal}</span>
          </div>
        </div>

        {order.address && (
          <div className="tracking-details card">
            <p className="section-label">DELIVER TO</p>
            <p style={{ margin: 0, fontSize: 14 }}>
              {order.address.fullName}
              <br />
              {formatAddressLine(order.address)}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function OrderTrackingPage() {
  return (
    <RequireAuth>
      <OrderTrackingInner />
    </RequireAuth>
  );
}

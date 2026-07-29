import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { IconBack, IconCheck, IconLocation, IconBike } from '../../components/ui/Icons';
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

function statusMessage(order, { cancelled, delivered }) {
  if (cancelled) return order.cancelledReason || 'This order was cancelled';
  if (delivered) return 'Thanks for ordering with GetNear — enjoy your meal!';
  if (order.orderStatus === ORDER_STATUS.OUT_FOR_DELIVERY) {
    return 'Your order is on the way';
  }
  if (order.orderStatus === ORDER_STATUS.PREPARING) {
    return 'The kitchen is preparing your food';
  }
  if (order.orderStatus === ORDER_STATUS.CONFIRMED) {
    return 'Restaurant confirmed your order';
  }
  return order.restaurantName
    ? `${order.restaurantName} received your order`
    : 'Your order has been placed';
}

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
      <div className="app-shell tracking-shell">
        <main className="page-container tracking-page">
          <div className="tracking-skel tracking-skel-banner" />
          <div className="tracking-skel tracking-skel-card" />
          <div className="tracking-skel tracking-skel-card" />
        </main>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="app-shell tracking-shell">
        <main className="page-container tracking-page">
          <div className="tracking-topbar">
            <Link to="/orders" className="back-btn" aria-label="Go back">
              <IconBack />
            </Link>
            <h1>Order</h1>
          </div>
          <div className="tracking-empty">
            <strong>Order not found</strong>
            <p>{error || 'This order may have been removed or the link is invalid.'}</p>
            <Link to="/orders" className="btn btn-primary">
              View orders
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const cancelled = order.orderStatus === ORDER_STATUS.CANCELLED;
  const delivered = order.orderStatus === ORDER_STATUS.DELIVERED;
  const activeIndex = getTimelineIndex(order.orderStatus);
  const statusLabel = ORDER_STATUS_LABELS[order.orderStatus] || order.orderStatus;
  const placedLabel = order.placedAt
    ? new Date(order.placedAt).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div className="app-shell tracking-shell animate-in">
      <main
        className={`page-container tracking-page${delivered ? ' tracking-page--delivered' : ''}${cancelled ? ' tracking-page--cancelled' : ''}`}
      >
        <div className="tracking-topbar">
          <Link to="/orders" className="back-btn" aria-label="Go back">
            <IconBack />
          </Link>
          <div className="tracking-topbar-copy">
            <h1>Order details</h1>
            <p>#{order.orderNumber}</p>
          </div>
        </div>

        <section
          className={`tracking-hero${delivered ? ' is-success' : ''}${cancelled ? ' is-danger' : ''}`}
        >
          <p className="tracking-hero-kicker">
            {delivered ? 'Completed' : cancelled ? 'Cancelled' : 'Live status'}
          </p>
          <h2>{cancelled ? 'Cancelled' : statusLabel}</h2>
          <p className="tracking-hero-sub">{statusMessage(order, { cancelled, delivered })}</p>
          {(order.restaurantName || placedLabel) && (
            <div className="tracking-hero-meta">
              {order.restaurantName && <span>{order.restaurantName}</span>}
              {placedLabel && <span>Placed {placedLabel}</span>}
            </div>
          )}
        </section>

        {!cancelled && (
          <section className={`tracking-timeline-card${delivered ? ' is-success' : ''}`}>
            <div className="tracking-timeline-head">
              <h3>Progress</h3>
              {!delivered && (
                <span className="tracking-live-dot">Updating</span>
              )}
            </div>
            <div className={`timeline${delivered ? ' timeline--success' : ''}`}>
              {ORDER_TIMELINE.map((status, index) => {
                let state = '';
                if (delivered || index < activeIndex) state = 'done';
                else if (index === activeIndex) state = 'active';

                return (
                  <div key={status} className={`timeline-step ${state}`}>
                    <div className="timeline-dot">
                      {state === 'done' || (delivered && state === 'active') ? (
                        <IconCheck />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span className="timeline-label">
                      {ORDER_STATUS_LABELS[status]}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="tracking-panel">
          <p className="tracking-panel-label">Items</p>
          <ul className="tracking-item-list">
            {order.items.map((item) => (
              <li key={item.id} className="tracking-item-row">
                <span className="tracking-item-qty">{item.quantity}×</span>
                <span className="tracking-item-name">{item.productName}</span>
                <span className="tracking-item-price">₹{item.totalPrice}</span>
              </li>
            ))}
          </ul>

          <div className="tracking-bill">
            {order.subtotal > 0 && (
              <div className="tracking-bill-row">
                <span>Item total</span>
                <span>₹{order.subtotal}</span>
              </div>
            )}
            {order.deliveryCharge > 0 && (
              <div className="tracking-bill-row">
                <span>Delivery</span>
                <span>₹{order.deliveryCharge}</span>
              </div>
            )}
            {order.taxAmount > 0 && (
              <div className="tracking-bill-row">
                <span>Taxes</span>
                <span>₹{order.taxAmount}</span>
              </div>
            )}
            {order.discountAmount > 0 && (
              <div className="tracking-bill-row tracking-bill-row--discount">
                <span>Discount</span>
                <span>−₹{order.discountAmount}</span>
              </div>
            )}
            <div className="tracking-bill-row tracking-bill-row--total">
              <span>Total · {String(order.paymentMethod || 'cod').toUpperCase()}</span>
              <span>₹{order.grandTotal}</span>
            </div>
          </div>
        </section>

        {order.address && (
          <section className="tracking-panel tracking-panel--delivery">
            <p className="tracking-panel-label">Deliver to</p>
            <div className="tracking-delivery">
              <span className="tracking-delivery-icon" aria-hidden="true">
                <IconLocation size={18} />
              </span>
              <div>
                <strong>{order.address.fullName}</strong>
                {order.address.phone && (
                  <p className="tracking-delivery-phone">+91 {order.address.phone}</p>
                )}
                <p>{formatAddressLine(order.address)}</p>
              </div>
            </div>
            {order.deliveryDistanceM != null && (
              <p className="tracking-distance">
                <IconBike size={14} />
                About {(order.deliveryDistanceM / 1000).toFixed(1)} km away
              </p>
            )}
          </section>
        )}

        <div className="tracking-actions">
          <Link to="/orders" className="btn btn-secondary btn-full">
            All orders
          </Link>
          {order.restaurantId && (
            <Link to={`/business/${order.restaurantId}`} className="btn btn-primary btn-full">
              Order again
            </Link>
          )}
        </div>
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

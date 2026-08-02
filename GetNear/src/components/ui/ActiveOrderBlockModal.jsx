import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import './ActiveOrderBlockModal.css';

export default function ActiveOrderBlockModal({ open, order, onClose }) {
  if (!open || !order) return null;

  return createPortal(
    <div
      className="active-order-block-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="active-order-block-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="active-order-block-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="active-order-block-header">
          <h2 id="active-order-block-title">Order in progress</h2>
          <button
            type="button"
            className="active-order-block-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className="active-order-block-body">
          You already have an order from{' '}
          <strong>{order.restaurantName || 'a restaurant'}</strong>
          {order.statusLabel ? ` (${order.statusLabel})` : ''}. Finish or wait
          until it is delivered before placing a new one.
        </p>
        <div className="active-order-block-actions">
          <button
            type="button"
            className="active-order-block-secondary"
            onClick={onClose}
          >
            OK
          </button>
          <Link
            to={`/order/${order.id}`}
            className="active-order-block-primary"
            onClick={onClose}
          >
            Track order
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}

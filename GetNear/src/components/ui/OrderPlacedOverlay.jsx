import './OrderPlacedOverlay.css';

/**
 * Full-screen success moment after checkout.
 * Parent hides it after a short delay.
 */
export default function OrderPlacedOverlay({ orderNumber }) {
  return (
    <div className="order-placed-overlay" role="status" aria-live="polite">
      <div className="order-placed-card">
        <div className="order-placed-tick" aria-hidden="true">
          <svg className="order-placed-svg" viewBox="0 0 52 52">
            <circle className="order-placed-circle" cx="26" cy="26" r="24" fill="none" />
            <path
              className="order-placed-check"
              fill="none"
              d="M14.1 27.2l7.1 7.2 16.7-16.8"
            />
          </svg>
        </div>
        <h2>Order placed!</h2>
        <p>
          {orderNumber
            ? `Order #${orderNumber}`
            : 'Your restaurant has received it'}
        </p>
      </div>
    </div>
  );
}

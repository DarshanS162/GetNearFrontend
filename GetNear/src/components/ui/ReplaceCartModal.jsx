import { createPortal } from 'react-dom';
import './ReplaceCartModal.css';

export default function ReplaceCartModal({
  open,
  fromName,
  toName,
  onCancel,
  onReplace,
}) {
  if (!open) return null;

  return createPortal(
    <div
      className="replace-cart-backdrop"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="replace-cart-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="replace-cart-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="replace-cart-header">
          <h2 id="replace-cart-title">Replace cart item?</h2>
          <button
            type="button"
            className="replace-cart-close"
            onClick={onCancel}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className="replace-cart-body">
          Your cart contains dishes from{' '}
          <strong>{fromName || 'another restaurant'}</strong>. Do you want to
          discard the selection and add dishes from{' '}
          <strong>{toName || 'this restaurant'}</strong>?
        </p>
        <div className="replace-cart-actions">
          <button type="button" className="replace-cart-no" onClick={onCancel}>
            No
          </button>
          <button
            type="button"
            className="replace-cart-yes"
            onClick={onReplace}
          >
            Replace
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

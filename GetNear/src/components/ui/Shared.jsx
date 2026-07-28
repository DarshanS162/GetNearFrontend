import { Link } from 'react-router-dom';
import { IconSearch, IconCart, IconChevron } from './Icons';

export function SearchBar({ placeholder = 'Search...', value, onChange }) {
  return (
    <div className="search-bar">
      <IconSearch />
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        aria-label={placeholder}
      />
    </div>
  );
}

export function QuantityControl({ quantity, onAdd, onRemove }) {
  if (quantity === 0) {
    return (
      <button type="button" className="btn-add" onClick={onAdd}>
        Add
      </button>
    );
  }

  return (
    <div className="qty-control">
      <button type="button" className="qty-btn" onClick={onRemove} aria-label="Decrease">
        −
      </button>
      <span className="qty-value">{quantity}</span>
      <button type="button" className="qty-btn" onClick={onAdd} aria-label="Increase">
        +
      </button>
    </div>
  );
}

export function StickyCartBar({ itemCount, total, to = '/cart' }) {
  if (itemCount === 0) return null;

  return (
    <Link to={to} className="sticky-cart-bar" aria-label={`View cart, ${itemCount} items, ₹${total}`}>
      <div className="sticky-cart-bar-left">
        <div className="sticky-cart-icon-wrap">
          <IconCart size={20} />
          <span className="sticky-cart-badge">{itemCount}</span>
        </div>
        <div className="sticky-cart-meta">
          <strong>View cart</strong>
          <span>
            {itemCount} item{itemCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      <div className="sticky-cart-bar-right">
        <span className="highlight">₹{total}</span>
        <IconChevron size={18} />
      </div>
    </Link>
  );
}

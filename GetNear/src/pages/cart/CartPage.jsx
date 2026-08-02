import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { IconBack, IconTicket } from '../../components/ui/Icons';
import { QuantityControl } from '../../components/ui/Shared';
import { isStoreOpen } from '../../domain/restaurant';
import {
  CartDeliverySection,
  readSelectedAddressId,
  writeSelectedAddressId,
} from '../../components/address';
import './CartPage.css';
import '../../components/address/address-components.css';
import '../../pages/account/AddressesPage.css';

export default function CartPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [couponCode, setCouponCode] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState(() => readSelectedAddressId());
  const [addOpen, setAddOpen] = useState(false);
  const {
    business,
    items,
    subtotal,
    discount,
    deliveryFee,
    taxes,
    total,
    coupon,
    couponError,
    applyingCoupon,
    applyCoupon,
    removeCoupon,
    addItem,
    removeItem,
  } = useCart();

  const storeOpen = isStoreOpen(business);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleSelectAddress = useCallback((id) => {
    setSelectedAddressId(id || '');
    writeSelectedAddressId(id || '');
  }, []);

  async function handleApplyCoupon(event) {
    event.preventDefault();
    try {
      await applyCoupon(couponCode);
    } catch {
      // The cart context exposes the customer-facing validation message.
    }
  }

  function handleCheckout() {
    if (!storeOpen) return;
    if (user && !selectedAddressId) {
      setAddOpen(true);
      return;
    }
    writeSelectedAddressId(selectedAddressId);
    navigate('/checkout', { state: { addressId: selectedAddressId || undefined } });
  }

  if (!items.length) {
    return (
      <div className="app-shell cart-shell animate-in">
        <main className="page-container cart-page">
          <div className="cart-topbar">
            <Link to={business?.id ? `/business/${business.id}` : '/'} className="back-btn" aria-label="Go back">
              <IconBack />
            </Link>
            <div className="cart-topbar-copy">
              <h1>Your cart</h1>
              <p>Nothing here yet</p>
            </div>
          </div>
          <div className="cart-empty">
            <strong>Cart is empty</strong>
            <p>Add something tasty from a nearby restaurant.</p>
            <Link to="/" className="btn btn-primary">
              Browse restaurants
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell cart-shell animate-in">
      <main className="page-container cart-page">
        <div className="cart-topbar">
          <Link to={`/business/${business?.id}`} className="back-btn" aria-label="Go back">
            <IconBack />
          </Link>
          <div className="cart-topbar-copy">
            <h1>Your cart</h1>
            <p>
              {business?.name || 'Restaurant'}
              {itemCount > 0 ? ` · ${itemCount} item${itemCount === 1 ? '' : 's'}` : ''}
            </p>
          </div>
        </div>

        {!storeOpen && (
          <div className="cart-alert cart-alert--closed" role="status">
            <strong>{business?.name || 'This store'} is closed</strong>
            <p>You can&apos;t checkout until the store opens again.</p>
          </div>
        )}

        <section className="cart-panel cart-panel--delivery">
          <CartDeliverySection
            selectedAddressId={selectedAddressId}
            onSelectAddressId={handleSelectAddress}
            addOpen={addOpen}
            onAddOpenChange={setAddOpen}
          />
        </section>

        <section className="cart-panel">
          <p className="cart-panel-label">Items</p>
          <div className="cart-items">
            {items.map((item) => (
              <div key={item.lineKey || item.id} className="cart-item">
                <div className="cart-item-info">
                  <h3>{item.lineName || item.name}</h3>
                  <span className="cart-item-price">₹{item.price}</span>
                </div>
                <QuantityControl
                  quantity={item.quantity}
                  onAdd={() => addItem(item.id, item.option)}
                  onRemove={() => removeItem(item.id, item.option)}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="cart-panel cart-panel--coupon">
          <div className="coupon-card-title">
            <span className="coupon-card-icon" aria-hidden="true">
              <IconTicket size={18} />
            </span>
            <span>Apply coupon</span>
          </div>
          {coupon ? (
            <div className="coupon-applied">
              <div>
                <strong>{coupon.code}</strong>
                <span>{coupon.message || 'Coupon applied'}</span>
              </div>
              <button type="button" className="btn-ghost btn-sm" onClick={removeCoupon}>
                Remove
              </button>
            </div>
          ) : (
            <form className="coupon-form" onSubmit={handleApplyCoupon}>
              <input
                className="form-input"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                placeholder="Enter coupon code"
                autoComplete="off"
              />
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={applyingCoupon || !couponCode.trim()}
              >
                {applyingCoupon ? 'Checking…' : 'Apply'}
              </button>
            </form>
          )}
          {couponError && <p className="coupon-error">{couponError}</p>}
        </section>

        <section className="cart-panel cart-panel--bill">
          <p className="cart-panel-label">Bill summary</p>
          <div className="bill-card">
            <div className="price-row">
              <span>Item total</span>
              <span>₹{subtotal}</span>
            </div>
            {discount > 0 && (
              <div className="price-row">
                <span>Discount</span>
                <span className="discount-amount">−₹{discount}</span>
              </div>
            )}
            {coupon?.deliveryDiscount > 0 && (
              <div className="price-row">
                <span>Delivery discount</span>
                <span className="discount-amount">−₹{coupon.deliveryDiscount}</span>
              </div>
            )}
            <div className="price-row">
              <span>Delivery fee</span>
              <span>₹{deliveryFee}</span>
            </div>
            {taxes > 0 && (
              <div className="price-row">
                <span>Taxes</span>
                <span>₹{taxes}</span>
              </div>
            )}
            <div className="price-row price-row--total">
              <span>Total</span>
              <span className="amount">₹{total}</span>
            </div>
          </div>
        </section>

        <div className="cart-checkout-bar">
          <div className="cart-checkout-meta">
            <span>To pay</span>
            <strong>₹{total}</strong>
          </div>
          <button
            type="button"
            className="btn btn-primary checkout-btn"
            onClick={handleCheckout}
            disabled={!storeOpen}
          >
            {!storeOpen
              ? 'Store closed'
              : user && !selectedAddressId
                ? 'Add location'
                : 'Checkout'}
          </button>
        </div>
      </main>
    </div>
  );
}

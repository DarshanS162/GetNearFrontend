import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { IconBack, IconTicket } from '../../components/ui/Icons';
import { QuantityControl } from '../../components/ui/Shared';
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
    if (user && !selectedAddressId) {
      setAddOpen(true);
      return;
    }
    writeSelectedAddressId(selectedAddressId);
    navigate('/checkout', { state: { addressId: selectedAddressId || undefined } });
  }

  return (
    <div className="app-shell animate-in">
      <main className="page-container cart-page">
        <div className="page-header">
          <Link to={`/business/${business?.id}`} className="back-btn" aria-label="Go back">
            <IconBack />
          </Link>
          <h1>Your cart</h1>
        </div>

        <p className="cart-restaurant">{business?.name?.toUpperCase()}</p>

        <CartDeliverySection
          selectedAddressId={selectedAddressId}
          onSelectAddressId={handleSelectAddress}
          addOpen={addOpen}
          onAddOpenChange={setAddOpen}
        />

        <div className="cart-items card">
          {items.map((item) => (
            <div key={item.id} className="cart-item">
              <div>
                <h3>{item.name}</h3>
                <span className="cart-item-price">₹{item.price}</span>
              </div>
              <QuantityControl
                quantity={item.quantity}
                onAdd={() => addItem(item.id)}
                onRemove={() => removeItem(item.id)}
              />
            </div>
          ))}
        </div>

        <div className="coupon-card card">
          <div className="coupon-card-title">
            <IconTicket size={20} />
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
        </div>

        <div className="bill-card card">
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
          <div className="price-row">
            <span>Taxes</span>
            <span>₹{taxes}</span>
          </div>
          <div className="price-row price-row--total">
            <span>Total</span>
            <span className="amount">₹{total}</span>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-full checkout-btn"
          onClick={handleCheckout}
        >
          {user && !selectedAddressId
            ? 'Add delivery location to continue'
            : 'Proceed to checkout'}
        </button>
      </main>
    </div>
  );
}

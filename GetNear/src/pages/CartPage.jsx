import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { IconBack, IconChevron, IconTicket } from '../components/ui/Icons';
import { QuantityControl } from '../components/ui/Shared';
import './CartPage.css';

export default function CartPage() {
  const {
    business,
    items,
    subtotal,
    discount,
    deliveryFee,
    taxes,
    total,
    setCoupon,
    coupon,
    addItem,
    removeItem,
  } = useCart();

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

        <button
          type="button"
          className="coupon-row card"
          onClick={() => setCoupon(coupon ? null : 'SAVE10')}
        >
          <IconTicket size={20} />
          <span>{coupon ? 'Coupon applied: SAVE10' : 'Apply coupon code'}</span>
          <IconChevron />
        </button>

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

        <Link to="/checkout" className="btn btn-primary btn-full checkout-btn">
          Proceed to checkout
        </Link>
      </main>
    </div>
  );
}

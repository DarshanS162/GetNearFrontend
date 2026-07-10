import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { userProfile } from '../data/mockData';
import { IconBack, IconLocation, IconUser, IconPhone, IconMore } from '../components/ui/Icons';
import './CheckoutPage.css';

const paymentMethods = [
  { id: 'upi', label: 'UPI', icon: '▦', recommended: true },
  { id: 'card', label: 'Credit / debit card', icon: '💳' },
  { id: 'cod', label: 'Cash on delivery', icon: '💵' },
];

export default function CheckoutPage() {
  const { total } = useCart();
  const navigate = useNavigate();
  const [payment, setPayment] = useState('upi');

  function handlePlaceOrder() {
    navigate('/order/GN2481');
  }

  return (
    <div className="app-shell animate-in">
      <main className="page-container checkout-page">
        <div className="page-header">
          <Link to="/cart" className="back-btn" aria-label="Go back">
            <IconBack />
          </Link>
          <h1>Checkout</h1>
          <button type="button" className="btn-icon" aria-label="More options">
            <IconMore />
          </button>
        </div>

        <div className="checkout-section card">
          <div className="address-row">
            <div className="address-icon">
              <IconLocation size={20} />
            </div>
            <div className="address-info">
              <strong>{userProfile.address.label}</strong>
              <p>{userProfile.address.line}</p>
            </div>
            <button type="button" className="btn-ghost btn-sm">Change</button>
          </div>
        </div>

        <div className="checkout-section card">
          <p className="section-label">CONTACT DETAILS</p>
          <div className="contact-row">
            <IconUser size={18} />
            <span>{userProfile.name}</span>
          </div>
          <div className="contact-row">
            <IconPhone size={18} />
            <span>{userProfile.phone}</span>
          </div>
        </div>

        <div className="checkout-section">
          <p className="section-label">PAYMENT METHOD</p>
          <div className="payment-list">
            {paymentMethods.map((method) => (
              <button
                key={method.id}
                type="button"
                className={`payment-option card ${payment === method.id ? 'payment-option--active' : ''}`}
                onClick={() => setPayment(method.id)}
              >
                <span className="payment-icon">{method.icon}</span>
                <span className="payment-label">{method.label}</span>
                {method.recommended && (
                  <span className="badge badge-recommended">RECOMMENDED</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="checkout-summary card">
          <div className="price-row">
            <span>Item total + fees</span>
            <span>₹{total}</span>
          </div>
          <div className="divider-dashed" />
          <div className="price-row price-row--total">
            <span>Total payable</span>
            <span className="amount">₹{total}</span>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-full place-order-btn"
          onClick={handlePlaceOrder}
        >
          Place order
        </button>
      </main>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { RequireAuth } from '../../components/auth/RequireAuth';
import { IconBack, IconLocation, IconUser, IconPhone } from '../../components/ui/Icons';
import { formatAddressLine } from '../../domain/address';
import { useAddresses } from '../../presentation/hooks/useAddresses';
import { orderUseCases } from '../../application/container';
import './CheckoutPage.css';

function CheckoutPageInner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    businessId,
    items,
    itemCount,
    subtotal,
    discount,
    deliveryFee,
    deliveryDiscount,
    taxes,
    total,
    coupon,
    clearCart,
  } = useCart();
  const { addresses, loading: addressesLoading, defaultAddress } = useAddresses();

  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (defaultAddress?.id) {
      setSelectedAddressId((prev) => prev || defaultAddress.id);
    }
  }, [defaultAddress?.id]);

  const selectedAddress =
    addresses.find((a) => a.id === selectedAddressId) || defaultAddress;

  async function handlePlaceOrder() {
    setError('');
    if (!itemCount || !businessId) {
      setError('Your cart is empty');
      return;
    }
    if (!selectedAddress?.id) {
      setError('Please add a delivery address');
      return;
    }

    setPlacing(true);
    try {
      const order = await orderUseCases.place.execute({
        customerId: user.id,
        restaurantId: businessId,
        addressId: selectedAddress.id,
        items: items.map((item) => ({
          productId: item.id,
          productName: item.name,
          foodType: item.foodType || 'veg',
          quantity: item.quantity,
          unitPrice: item.price,
        })),
        subtotal,
        discountAmount: discount,
        deliveryCharge: deliveryFee,
        deliveryDiscount,
        taxAmount: taxes,
        grandTotal: total,
        couponCode: coupon?.code || '',
        paymentMethod: 'cod',
      });

      clearCart();
      navigate(`/order/${order.id}`);
    } catch (err) {
      setError(err.message || 'Could not place order');
    } finally {
      setPlacing(false);
    }
  }

  if (!itemCount) {
    return (
      <div className="app-shell animate-in">
        <main className="page-container checkout-page">
          <div className="page-header">
            <Link to="/cart" className="back-btn" aria-label="Go back">
              <IconBack />
            </Link>
            <h1>Checkout</h1>
          </div>
          <div className="empty-state card">
            <p>Your cart is empty.</p>
            <Link to="/" className="btn btn-primary" style={{ marginTop: 12 }}>
              Browse stores
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell animate-in">
      <main className="page-container checkout-page">
        <div className="page-header">
          <Link to="/cart" className="back-btn" aria-label="Go back">
            <IconBack />
          </Link>
          <h1>Checkout</h1>
        </div>

        <div className="checkout-section card">
          <div className="address-row">
            <div className="address-icon">
              <IconLocation size={20} />
            </div>
            <div className="address-info">
              {addressesLoading && <p>Loading addresses…</p>}
              {!addressesLoading && selectedAddress && (
                <>
                  <strong style={{ textTransform: 'capitalize' }}>
                    {selectedAddress.label}
                  </strong>
                  <p>{formatAddressLine(selectedAddress)}</p>
                </>
              )}
              {!addressesLoading && !selectedAddress && (
                <p>No delivery address yet.</p>
              )}
            </div>
            {addresses.length > 0 ? (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => setPickerOpen((v) => !v)}
              >
                Change
              </button>
            ) : (
              <Link to="/addresses" className="btn-ghost btn-sm">
                Add
              </Link>
            )}
          </div>

          {pickerOpen && (
            <div className="address-picker">
              {addresses.map((address) => (
                <button
                  key={address.id}
                  type="button"
                  className={`address-picker-item ${
                    address.id === selectedAddress?.id ? 'active' : ''
                  }`}
                  onClick={() => {
                    setSelectedAddressId(address.id);
                    setPickerOpen(false);
                  }}
                >
                  <strong style={{ textTransform: 'capitalize' }}>{address.label}</strong>
                  <span>{formatAddressLine(address)}</span>
                </button>
              ))}
              <Link to="/addresses" className="btn-ghost btn-sm" style={{ marginTop: 8 }}>
                Manage addresses
              </Link>
            </div>
          )}
        </div>

        <div className="checkout-section card">
          <p className="section-label">CONTACT DETAILS</p>
          <div className="contact-row">
            <IconUser size={18} />
            <span>{selectedAddress?.fullName || user?.fullName}</span>
          </div>
          <div className="contact-row">
            <IconPhone size={18} />
            <span>{selectedAddress?.phone || user?.phone}</span>
          </div>
        </div>

        <div className="checkout-section">
          <p className="section-label">PAYMENT METHOD</p>
          <div className="payment-list">
            <div className="payment-option card payment-option--active">
              <span className="payment-icon">💵</span>
              <span className="payment-label">Cash on delivery</span>
              <span className="badge badge-recommended">AVAILABLE</span>
            </div>
          </div>
        </div>

        <div className="checkout-summary card">
          <div className="price-row">
            <span>Item total</span>
            <span>₹{subtotal}</span>
          </div>
          {discount > 0 && (
            <div className="price-row">
              <span>Discount</span>
              <span>-₹{discount}</span>
            </div>
          )}
          {deliveryDiscount > 0 && (
            <div className="price-row">
              <span>Delivery discount</span>
              <span>-₹{deliveryDiscount}</span>
            </div>
          )}
          <div className="price-row">
            <span>Delivery</span>
            <span>₹{deliveryFee}</span>
          </div>
          <div className="price-row">
            <span>Taxes</span>
            <span>₹{taxes}</span>
          </div>
          <div className="divider-dashed" />
          <div className="price-row price-row--total">
            <span>Total payable</span>
            <span className="amount">₹{total}</span>
          </div>
        </div>

        {error && <p className="checkout-error">{error}</p>}

        <button
          type="button"
          className="btn btn-primary btn-full place-order-btn"
          onClick={handlePlaceOrder}
          disabled={placing || !selectedAddress}
        >
          {placing ? 'Placing order…' : `Place order · ₹${total}`}
        </button>
      </main>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <RequireAuth>
      <CheckoutPageInner />
    </RequireAuth>
  );
}

import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useCatalog } from '../../context/CatalogContext';
import { RequireAuth } from '../../components/auth/RequireAuth';
import { IconBack, IconLocation, IconUser, IconPhone } from '../../components/ui/Icons';
import { formatAddressLine } from '../../domain/address';
import { isStoreOpen } from '../../domain/restaurant';
import { useAddresses } from '../../presentation/hooks/useAddresses';
import { orderUseCases, branchRepository, addressRepository } from '../../application/container';
import {
  readSelectedAddressId,
  writeSelectedAddressId,
} from '../../components/address';
import '../../components/address/address-components.css';
import './CheckoutPage.css';

function CheckoutPageInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { getBusiness } = useCatalog();
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
  const restaurant = getBusiness(businessId);
  const storeOpen = isStoreOpen(restaurant);

  const [selectedAddressId, setSelectedAddressId] = useState(
    () => location.state?.addressId || readSelectedAddressId() || '',
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [toast, setToast] = useState('');
  const [radiusError, setRadiusError] = useState('');
  const [radiusChecking, setRadiusChecking] = useState(false);

  useEffect(() => {
    if (selectedAddressId) {
      writeSelectedAddressId(selectedAddressId);
      return;
    }
    if (defaultAddress?.id) {
      setSelectedAddressId(defaultAddress.id);
      writeSelectedAddressId(defaultAddress.id);
    }
  }, [defaultAddress?.id, selectedAddressId]);

  const selectedAddress =
    addresses.find((a) => a.id === selectedAddressId) || defaultAddress;

  const selectedHasPin =
    selectedAddress?.latitude != null && selectedAddress?.longitude != null;

  useEffect(() => {
    let cancelled = false;
    async function checkRadius() {
      setRadiusError('');
      if (!businessId || !selectedAddress?.id || !selectedHasPin) return;
      setRadiusChecking(true);
      try {
        const branchId = await branchRepository.ensureMainBranchId(businessId);
        await addressRepository.validateDelivery(selectedAddress.id, branchId);
        if (!cancelled) setRadiusError('');
      } catch (err) {
        if (!cancelled) {
          setRadiusError(
            err.message || 'This address is outside the delivery area for this store.',
          );
        }
      } finally {
        if (!cancelled) setRadiusChecking(false);
      }
    }
    checkRadius();
    return () => {
      cancelled = true;
    };
  }, [businessId, selectedAddress?.id, selectedHasPin]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  }

  async function handlePlaceOrder() {
    if (!itemCount || !businessId) {
      showToast('Your cart is empty');
      return;
    }
    if (!storeOpen) {
      showToast('This store is closed right now. Please try again when it opens.');
      return;
    }
    if (!selectedAddress?.id) {
      showToast('Please add a delivery address');
      return;
    }
    if (!selectedHasPin) {
      showToast('Selected address needs a map pin. Edit it under Saved addresses.');
      return;
    }
    if (radiusError) {
      showToast(radiusError);
      return;
    }

    setPlacing(true);
    try {
      // Backend receives addressId only — ownership, radius, and snapshot are server-side.
      const order = await orderUseCases.place.execute({
        customerId: user.id,
        restaurantId: businessId,
        addressId: selectedAddress.id,
        items: items.map((item) => ({
          productId: item.id,
          productName: item.lineName || item.name,
          foodType: item.foodType || 'veg',
          quantity: item.quantity,
          unitPrice: item.price,
          pricingOption: item.option || 'piece',
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
      showToast(err.message || 'Could not place order');
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

        {!storeOpen && (
          <div className="checkout-section card" style={{ background: 'rgba(239,68,68,0.08)', marginBottom: 12 }}>
            <strong>{restaurant?.name || 'This store'} is closed</strong>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--color-text-secondary)' }}>
              Orders cannot be placed until the store opens again.
            </p>
          </div>
        )}

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
                  {!selectedHasPin && (
                    <p className="form-error" style={{ marginTop: 6 }}>
                      This address has no map pin. Update it before ordering.
                    </p>
                  )}
                  {radiusChecking && (
                    <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                      Checking delivery area…
                    </p>
                  )}
                  {radiusError && (
                    <p className="form-error" style={{ marginTop: 6 }}>
                      {radiusError}
                    </p>
                  )}
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
              <Link to="/cart" className="btn-ghost btn-sm">
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
                    writeSelectedAddressId(address.id);
                    setPickerOpen(false);
                  }}
                >
                  <strong style={{ textTransform: 'capitalize' }}>{address.label}</strong>
                  <span>{formatAddressLine(address)}</span>
                </button>
              ))}
              <Link to="/cart" className="btn-ghost btn-sm" style={{ marginTop: 8 }}>
                Change on cart
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
              <div className="payment-copy">
                <span className="payment-label">Cash on delivery</span>
                <span className="payment-hint">Pay ₹{total} in cash when your order arrives</span>
              </div>
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
            <span>Pay on delivery</span>
            <span className="amount">₹{total}</span>
          </div>
          <p className="checkout-cod-note">
            You&apos;ll pay ₹{total} in cash when your order is delivered.
          </p>
        </div>

        {toast && <div className="admin-toast checkout-toast">{toast}</div>}

        <button
          type="button"
          className="btn btn-primary btn-full place-order-btn"
          onClick={handlePlaceOrder}
          disabled={
            placing ||
            !storeOpen ||
            !selectedAddress ||
            !selectedHasPin ||
            Boolean(radiusError) ||
            radiusChecking
          }
        >
          {!storeOpen
            ? 'Store closed'
            : radiusError
              ? 'Outside delivery area'
              : placing
              ? 'Placing order…'
              : `Place COD order · ₹${total}`}
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

import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCatalog } from '../../context/CatalogContext';
import { partnerUseCases, branchRepository } from '../../application/container';
import { BUSINESS_STATUS, BUSINESS_STATUS_LABELS } from '../../domain/restaurant';
import ImageField from '../../components/ui/ImageField';
import { uploadImage } from '../../lib/storage';
import './OwnerLayout.css';

const RADIUS_OPTIONS = [
  { value: '0', label: 'Everywhere (no limit)' },
  { value: '3', label: '3 km' },
  { value: '5', label: '5 km' },
  { value: '10', label: '10 km' },
  { value: '15', label: '15 km' },
  { value: '25', label: '25 km' },
  { value: '50', label: '50 km' },
  { value: 'custom', label: 'Custom' },
];

export default function OwnerSettingsPage() {
  const { user } = useAuth();
  const { getBusiness, refreshCatalog } = useCatalog();
  const restaurant = getBusiness(user?.restaurantId);

  const [form, setForm] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingRadius, setSavingRadius] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [toast, setToast] = useState('');

  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState('5');
  const [customRadius, setCustomRadius] = useState('');
  const [radiusLoaded, setRadiusLoaded] = useState(false);

  useEffect(() => {
    if (!restaurant) {
      setForm(null);
      return;
    }
    setForm({
      name: restaurant.name || '',
      type: restaurant.type || '',
      location: restaurant.location || '',
      description: restaurant.description || '',
      contactPhone: restaurant.contactPhone || '',
      contactEmail: restaurant.contactEmail || '',
      gstNumber: restaurant.gstNumber || '',
      fssaiNumber: restaurant.fssaiNumber || '',
      deliveryTime: String(restaurant.deliveryTime || 30),
      freeDeliveryAbove: String(restaurant.freeDeliveryAbove || 299),
      bannerColor: restaurant.bannerColor || '#FFF0E8',
      icon: restaurant.icon || '🍽️',
      offer: restaurant.offer || '',
      bannerUrl: restaurant.bannerUrl || '',
    });

    branchRepository
      .getDeliveryRadiusKm(restaurant.id)
      .then((km) => {
        const str = String(km);
        const isPreset = RADIUS_OPTIONS.some((o) => o.value === str);
        if (isPreset) {
          setDeliveryRadiusKm(str);
          setCustomRadius('');
        } else {
          setDeliveryRadiusKm('custom');
          setCustomRadius(str);
        }
        setRadiusLoaded(true);
      })
      .catch(() => {
        setRadiusLoaded(true);
      });
  }, [restaurant]);

  if (!restaurant || !form) {
    return (
      <div className="admin-page-header">
        <h1>Store settings</h1>
        <p>No restaurant linked yet. Submit a partner application first.</p>
      </div>
    );
  }

  const pending = restaurant.businessStatus === BUSINESS_STATUS.PENDING_APPROVAL;
  const rejected = restaurant.businessStatus === BUSINESS_STATUS.REJECTED;
  const canToggle = restaurant.businessStatus === BUSINESS_STATUS.ACTIVE;

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function getEffectiveRadius() {
    if (deliveryRadiusKm === 'custom') {
      const n = Number(customRadius);
      return !isNaN(n) && n >= 0 ? n : 5;
    }
    return Number(deliveryRadiusKm);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      let bannerUrl = form.bannerUrl;
      if (imageFile) {
        bannerUrl = await uploadImage('restaurant-assets', imageFile, 'banners');
      }
      await partnerUseCases.updateStore.execute(restaurant.id, { ...form, bannerUrl });
      await refreshCatalog();
      showToast('Store details saved');
      setImageFile(null);
    } catch (err) {
      showToast(err.message || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRadius() {
    setSavingRadius(true);
    try {
      await branchRepository.setDeliveryRadiusKm(restaurant.id, getEffectiveRadius());
      showToast('Delivery radius saved');
    } catch (err) {
      showToast(err.message || 'Could not save delivery radius');
    } finally {
      setSavingRadius(false);
    }
  }

  async function handleToggleOpen() {
    if (!canToggle) return;
    setToggling(true);
    try {
      await partnerUseCases.setOpen.execute(restaurant.id, !restaurant.isOpen);
      await refreshCatalog();
      showToast(!restaurant.isOpen ? 'Store is now open' : 'Store is now closed');
    } catch (err) {
      showToast(err.message || 'Could not update store status');
    } finally {
      setToggling(false);
    }
  }

  const effectiveRadius = getEffectiveRadius();

  return (
    <div className="owner-settings-page">
      <div className="admin-page-header">
        <h1>Store settings</h1>
        <p>Manage status, delivery area, and store details.</p>
      </div>

      {pending && (
        <div className="owner-alert owner-alert--warn">
          Your application is waiting for admin approval. Customers cannot see your store yet.
        </div>
      )}

      {rejected && (
        <div className="owner-alert owner-alert--danger">
          Application rejected{restaurant.rejectionReason ? `: ${restaurant.rejectionReason}` : '.'}
          {' '}You can contact support or re-apply with a different account.
        </div>
      )}

      {/* —— Store status —— */}
      <section className="card owner-settings-section">
        <div className="owner-settings-section-head">
          <div>
            <h2>Store status</h2>
            <p>
              {BUSINESS_STATUS_LABELS[restaurant.businessStatus] || restaurant.businessStatus}
              {canToggle && <> · Currently <strong>{restaurant.isOpen ? 'Open' : 'Closed'}</strong></>}
            </p>
          </div>
          {canToggle && (
            <span
              className={`owner-status-pill ${
                restaurant.isOpen ? 'owner-status-pill--success' : 'owner-status-pill--muted'
              }`}
            >
              {restaurant.isOpen ? 'Open now' : 'Closed'}
            </span>
          )}
        </div>
        {canToggle ? (
          <button
            type="button"
            className={`btn ${restaurant.isOpen ? 'btn-secondary' : 'btn-primary'} owner-settings-section-btn`}
            onClick={handleToggleOpen}
            disabled={toggling}
          >
            {toggling ? 'Updating…' : restaurant.isOpen ? 'Mark closed' : 'Mark open'}
          </button>
        ) : (
          <p className="form-hint" style={{ margin: 0 }}>
            Open/close is available after your store is approved.
          </p>
        )}
      </section>

      {/* —— Delivery radius —— */}
      <section className="card owner-settings-section">
        <div className="owner-settings-section-head">
          <div>
            <h2>Delivery radius</h2>
            <p>How far customers can order from your store.</p>
          </div>
        </div>

        {radiusLoaded ? (
          <>
            <div className="owner-radius-chips">
              {RADIUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`chip ${deliveryRadiusKm === opt.value ? 'chip-active' : ''}`}
                  onClick={() => {
                    setDeliveryRadiusKm(opt.value);
                    if (opt.value !== 'custom') setCustomRadius('');
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {deliveryRadiusKm === 'custom' && (
              <input
                type="number"
                min="0"
                step="0.5"
                className="form-input owner-custom-radius"
                placeholder="Enter radius in km"
                value={customRadius}
                onChange={(e) => setCustomRadius(e.target.value)}
              />
            )}

            <p className="form-hint">
              {effectiveRadius === 0
                ? 'Delivery is available everywhere — no distance restriction.'
                : `Customers within ${effectiveRadius} km of your store can place orders.`}
            </p>

            <button
              type="button"
              className="btn btn-primary owner-settings-section-btn"
              onClick={handleSaveRadius}
              disabled={savingRadius}
            >
              {savingRadius ? 'Saving…' : 'Save delivery radius'}
            </button>
          </>
        ) : (
          <p className="form-hint" style={{ margin: 0 }}>Loading…</p>
        )}
      </section>

      {/* —— Store details —— */}
      <section className="card owner-settings-section">
        <div className="owner-settings-section-head">
          <div>
            <h2>Store details</h2>
            <p>Name, contact, and other store information.</p>
          </div>
        </div>

        <form className="owner-settings-form" onSubmit={handleSave}>
          <label className="form-label owner-settings-field">
            Store name *
            <input name="name" className="form-input" value={form.name} onChange={handleChange} required />
          </label>

          <div className="owner-form-grid">
            <label className="form-label">
              Cuisine
              <input name="type" className="form-input" value={form.type} onChange={handleChange} />
            </label>
            <label className="form-label">
              Location
              <input name="location" className="form-input" value={form.location} onChange={handleChange} />
            </label>
          </div>

          <label className="form-label owner-settings-field">
            Description
            <textarea name="description" className="form-input" rows={3} value={form.description} onChange={handleChange} />
          </label>

          <div className="owner-form-grid">
            <label className="form-label">
              Phone
              <input name="contactPhone" className="form-input" value={form.contactPhone} onChange={handleChange} />
            </label>
            <label className="form-label">
              Email
              <input name="contactEmail" className="form-input" value={form.contactEmail} onChange={handleChange} />
            </label>
          </div>

          <div className="owner-form-grid">
            <label className="form-label">
              Delivery time (min)
              <input name="deliveryTime" className="form-input" value={form.deliveryTime} onChange={handleChange} />
            </label>
            <label className="form-label">
              Free delivery above (₹)
              <input name="freeDeliveryAbove" className="form-input" value={form.freeDeliveryAbove} onChange={handleChange} />
            </label>
          </div>

          <div className="owner-form-grid">
            <label className="form-label">
              GST
              <input name="gstNumber" className="form-input" value={form.gstNumber} onChange={handleChange} />
            </label>
            <label className="form-label">
              FSSAI
              <input name="fssaiNumber" className="form-input" value={form.fssaiNumber} onChange={handleChange} />
            </label>
          </div>

          {form.bannerUrl && !imageFile && (
            <div className="owner-settings-banner">
              <img src={form.bannerUrl} alt="" />
            </div>
          )}

          <div className="owner-settings-field">
            <ImageField
              id="owner-banner"
              label="Banner image"
              value={imageFile}
              onChange={setImageFile}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={saving}>
            {saving ? 'Saving…' : 'Save store details'}
          </button>
        </form>
      </section>

      {toast && <div className="admin-toast">{toast}</div>}
    </div>
  );
}

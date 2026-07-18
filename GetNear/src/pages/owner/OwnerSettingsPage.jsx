import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCatalog } from '../../context/CatalogContext';
import { partnerUseCases } from '../../application/container';
import { BUSINESS_STATUS, BUSINESS_STATUS_LABELS } from '../../domain/restaurant';
import ImageField from '../../components/ui/ImageField';
import { uploadImage } from '../../lib/storage';

export default function OwnerSettingsPage() {
  const { user } = useAuth();
  const { getBusiness, refreshCatalog } = useCatalog();
  const restaurant = getBusiness(user?.restaurantId);

  const [form, setForm] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      let bannerUrl = form.bannerUrl;
      if (imageFile) {
        bannerUrl = await uploadImage('restaurant-assets', imageFile, 'banners');
      }
      await partnerUseCases.updateStore.execute(restaurant.id, { ...form, bannerUrl });
      await refreshCatalog();
      setMessage('Store details saved');
      setImageFile(null);
    } catch (err) {
      setError(err.message || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleOpen() {
    if (!canToggle) return;
    setToggling(true);
    setError('');
    setMessage('');
    try {
      await partnerUseCases.setOpen.execute(restaurant.id, !restaurant.isOpen);
      await refreshCatalog();
      setMessage(!restaurant.isOpen ? 'Store is now open' : 'Store is now closed');
    } catch (err) {
      setError(err.message || 'Could not update open/closed status');
    } finally {
      setToggling(false);
    }
  }

  return (
    <>
      <div className="admin-page-header admin-page-header-row">
        <div>
          <h1>Store settings</h1>
          <p>
            Status:{' '}
            <strong>
              {BUSINESS_STATUS_LABELS[restaurant.businessStatus] || restaurant.businessStatus}
            </strong>
            {canToggle && (
              <> · Currently <strong>{restaurant.isOpen ? 'Open' : 'Closed'}</strong></>
            )}
          </p>
        </div>
        {canToggle && (
          <button
            type="button"
            className={`btn ${restaurant.isOpen ? 'btn-secondary' : 'btn-primary'}`}
            onClick={handleToggleOpen}
            disabled={toggling}
          >
            {toggling ? 'Updating…' : restaurant.isOpen ? 'Mark closed' : 'Mark open'}
          </button>
        )}
      </div>

      {pending && (
        <div className="card" style={{ padding: 16, marginBottom: 16, background: 'rgba(255,159,28,0.1)' }}>
          Your application is waiting for admin approval. Customers cannot see your store yet.
        </div>
      )}

      {rejected && (
        <div className="card" style={{ padding: 16, marginBottom: 16, color: '#ef4444' }}>
          Application rejected{restaurant.rejectionReason ? `: ${restaurant.rejectionReason}` : '.'}
          {' '}You can contact support or re-apply with a different account.
        </div>
      )}

      {message && (
        <div className="card" style={{ padding: 12, marginBottom: 16, color: 'var(--color-primary)' }}>
          {message}
        </div>
      )}
      {error && (
        <div className="card" style={{ padding: 12, marginBottom: 16, color: '#ef4444' }}>
          {error}
        </div>
      )}

      <form className="card" style={{ padding: 20 }} onSubmit={handleSave}>
        <label className="form-label" style={{ display: 'block', marginBottom: 12 }}>
          Store name *
          <input name="name" className="form-input" value={form.name} onChange={handleChange} required />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <label className="form-label">
            Cuisine
            <input name="type" className="form-input" value={form.type} onChange={handleChange} />
          </label>
          <label className="form-label">
            Location
            <input name="location" className="form-input" value={form.location} onChange={handleChange} />
          </label>
        </div>

        <label className="form-label" style={{ display: 'block', marginBottom: 12 }}>
          Description
          <textarea name="description" className="form-input" rows={3} value={form.description} onChange={handleChange} />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <label className="form-label">
            Phone
            <input name="contactPhone" className="form-input" value={form.contactPhone} onChange={handleChange} />
          </label>
          <label className="form-label">
            Email
            <input name="contactEmail" className="form-input" value={form.contactEmail} onChange={handleChange} />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <label className="form-label">
            Delivery time (min)
            <input name="deliveryTime" className="form-input" value={form.deliveryTime} onChange={handleChange} />
          </label>
          <label className="form-label">
            Free delivery above (₹)
            <input name="freeDeliveryAbove" className="form-input" value={form.freeDeliveryAbove} onChange={handleChange} />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
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
          <div style={{ marginBottom: 12 }}>
            <img
              src={form.bannerUrl}
              alt=""
              style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 12 }}
            />
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <ImageField
            id="owner-banner"
            label="Banner image"
            value={imageFile}
            onChange={setImageFile}
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </form>
    </>
  );
}

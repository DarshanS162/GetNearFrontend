import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar';
import { RequireAuth } from '../../components/auth/RequireAuth';
import { IconBack } from '../../components/ui/Icons';
import { ADDRESS_LABELS, formatAddressLine } from '../../domain/address';
import { useAddresses } from '../../presentation/hooks/useAddresses';
import { useAuth } from '../../context/AuthContext';
import './AddressesPage.css';

const emptyForm = {
  label: 'home',
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  pincode: '',
  isDefault: false,
};

function AddressesPageInner() {
  const { user } = useAuth();
  const {
    addresses,
    loading,
    error,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
  } = useAddresses();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  function openAdd() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      fullName: user?.fullName || '',
      phone: user?.phone || '',
      isDefault: addresses.length === 0,
    });
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(address) {
    setEditingId(address.id);
    setForm({
      label: address.label,
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      isDefault: address.isDefault,
    });
    setFormError('');
    setFormOpen(true);
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        await updateAddress(editingId, form);
      } else {
        await createAddress(form);
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(err.message || 'Could not save address');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell animate-in">
      <Navbar showLocation={false} />
      <main className="page-container addresses-page">
        <div className="page-header">
          <Link to="/profile" className="back-btn" aria-label="Go back">
            <IconBack />
          </Link>
          <h1>Saved addresses</h1>
          <button type="button" className="btn btn-primary btn-sm" onClick={openAdd}>
            Add
          </button>
        </div>

        {loading && <p className="muted">Loading addresses…</p>}
        {error && <p className="form-error">{error}</p>}

        {!loading && addresses.length === 0 && (
          <div className="empty-state card">
            <p>No saved addresses yet.</p>
            <span className="empty-state-sub">Add one to checkout faster.</span>
          </div>
        )}

        <div className="address-list">
          {addresses.map((address) => (
            <div key={address.id} className="address-card card">
              <div className="address-card-top">
                <strong className="address-label">{address.label}</strong>
                {address.isDefault && <span className="badge badge-success">Default</span>}
              </div>
              <p className="address-name">{address.fullName} · {address.phone}</p>
              <p className="address-line">{formatAddressLine(address)}</p>
              <div className="address-actions">
                {!address.isDefault && (
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => setDefaultAddress(address.id)}
                  >
                    Set default
                  </button>
                )}
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => openEdit(address)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => deleteAddress(address.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {formOpen && (
          <div className="address-form-overlay">
            <form className="address-form card" onSubmit={handleSubmit}>
              <h2>{editingId ? 'Edit address' : 'Add address'}</h2>
              {formError && <p className="form-error">{formError}</p>}

              <label className="form-label">
                Label
                <select name="label" className="form-input" value={form.label} onChange={handleChange}>
                  {ADDRESS_LABELS.map((label) => (
                    <option key={label} value={label}>{label}</option>
                  ))}
                </select>
              </label>

              <label className="form-label">
                Full name
                <input name="fullName" className="form-input" value={form.fullName} onChange={handleChange} required />
              </label>

              <label className="form-label">
                Phone
                <input name="phone" className="form-input" value={form.phone} onChange={handleChange} required />
              </label>

              <label className="form-label">
                Address line 1
                <input name="line1" className="form-input" value={form.line1} onChange={handleChange} required />
              </label>

              <label className="form-label">
                Address line 2
                <input name="line2" className="form-input" value={form.line2} onChange={handleChange} />
              </label>

              <div className="form-row">
                <label className="form-label">
                  City
                  <input name="city" className="form-input" value={form.city} onChange={handleChange} required />
                </label>
                <label className="form-label">
                  State
                  <input name="state" className="form-input" value={form.state} onChange={handleChange} required />
                </label>
              </div>

              <label className="form-label">
                Pincode
                <input name="pincode" className="form-input" value={form.pincode} onChange={handleChange} required maxLength={6} />
              </label>

              <label className="form-check">
                <input
                  type="checkbox"
                  name="isDefault"
                  checked={form.isDefault}
                  onChange={handleChange}
                />
                Set as default
              </label>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

export default function AddressesPage() {
  return (
    <RequireAuth>
      <AddressesPageInner />
    </RequireAuth>
  );
}

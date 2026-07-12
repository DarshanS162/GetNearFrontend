import { useState } from 'react';
import { useCatalog } from '../../context/CatalogContext';

const emptyForm = {
  name: '',
  type: '',
  location: '',
  description: '',
  contactPhone: '',
  contactEmail: '',
  ownerName: '',
  ownerPhone: '',
  gstNumber: '',
  fssaiNumber: '',
  deliveryTime: '30',
  freeDeliveryAbove: '299',
  businessStatus: 'active',
  category: 'food',
  icon: '🍽️',
  bannerColor: '#FFF0E8',
  offer: '',
};

export default function AdminRestaurants() {
  const { businesses, addRestaurant, deleteRestaurant, slugify } = useCatalog();
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.ownerPhone.trim() || !form.ownerName.trim()) return;

    setSaving(true);
    try {
      await addRestaurant(form);
      setForm(emptyForm);
      showToast(`Restaurant "${form.name}" added successfully`);
    } catch (err) {
      showToast(err.message || 'Failed to save restaurant');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="admin-page-header">
        <h1>Restaurants</h1>
        <p>Add restaurants and assign an owner phone so they can manage their own menu.</p>
      </div>

      <div className="admin-grid">
        <div className="card admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Restaurant</th>
                <th>Owner</th>
                <th>Location</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {businesses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="admin-empty">No restaurants yet</td>
                </tr>
              ) : (
                businesses.map((biz) => (
                  <tr key={biz.id}>
                    <td>
                      <span className="admin-table-name">
                        {biz.icon} {biz.name}
                      </span>
                      <span className="admin-table-meta">{biz.type}</span>
                    </td>
                    <td>
                      <span className="admin-table-name">{biz.ownerName || '—'}</span>
                      <span className="admin-table-meta">{biz.ownerPhone || '—'}</span>
                    </td>
                    <td>{biz.location || '—'}</td>
                    <td>
                      <span className={`badge ${biz.isOpen ? 'badge-success' : 'badge-primary'}`}>
                        {biz.businessStatus || (biz.isOpen ? 'active' : 'inactive')}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={async () => {
                          if (window.confirm(`Delete "${biz.name}" and all its menu items?`)) {
                            try {
                              await deleteRestaurant(biz.id);
                              showToast(`Deleted ${biz.name}`);
                            } catch (err) {
                              showToast(err.message || 'Delete failed');
                            }
                          }
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <form className="card admin-form" onSubmit={handleSubmit}>
          <h2>Add restaurant</h2>

          <div className="form-group">
            <label className="form-label" htmlFor="name">Restaurant name *</label>
            <input
              id="name"
              name="name"
              className="form-input"
              value={form.name}
              onChange={handleChange}
              placeholder="Sharma Tiffin Corner"
              required
            />
            {form.name && (
              <p className="form-hint">Slug: {slugify(form.name)}</p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="type">Cuisine / type</label>
            <input
              id="type"
              name="type"
              className="form-input"
              value={form.type}
              onChange={handleChange}
              placeholder="North Indian, thali"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="location">Location</label>
            <input
              id="location"
              name="location"
              className="form-input"
              value={form.location}
              onChange={handleChange}
              placeholder="Andheri West, Mumbai"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              className="form-input"
              rows={3}
              value={form.description}
              onChange={handleChange}
              placeholder="Short description for customers"
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="contactPhone">Phone</label>
              <input
                id="contactPhone"
                name="contactPhone"
                className="form-input"
                value={form.contactPhone}
                onChange={handleChange}
                placeholder="+91 98765 43210"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="contactEmail">Email</label>
              <input
                id="contactEmail"
                name="contactEmail"
                type="email"
                className="form-input"
                value={form.contactEmail}
                onChange={handleChange}
                placeholder="owner@restaurant.com"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="ownerName">Owner name *</label>
              <input
                id="ownerName"
                name="ownerName"
                className="form-input"
                value={form.ownerName}
                onChange={handleChange}
                placeholder="Restaurant owner full name"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ownerPhone">Owner mobile *</label>
              <input
                id="ownerPhone"
                name="ownerPhone"
                type="tel"
                className="form-input"
                value={form.ownerPhone}
                onChange={handleChange}
                placeholder="9876543210"
                required
              />
              <p className="form-hint">Owner logs in with this number to manage their menu.</p>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="gstNumber">GST number</label>
              <input
                id="gstNumber"
                name="gstNumber"
                className="form-input"
                value={form.gstNumber}
                onChange={handleChange}
                placeholder="22AAAAA0000A1Z5"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="fssaiNumber">FSSAI number</label>
              <input
                id="fssaiNumber"
                name="fssaiNumber"
                className="form-input"
                value={form.fssaiNumber}
                onChange={handleChange}
                placeholder="12345678901234"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="deliveryTime">Delivery time (min)</label>
              <input
                id="deliveryTime"
                name="deliveryTime"
                type="number"
                min="5"
                className="form-input"
                value={form.deliveryTime}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="freeDeliveryAbove">Free delivery above (₹)</label>
              <input
                id="freeDeliveryAbove"
                name="freeDeliveryAbove"
                type="number"
                min="0"
                className="form-input"
                value={form.freeDeliveryAbove}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="category">Category</label>
              <select
                id="category"
                name="category"
                className="form-input"
                value={form.category}
                onChange={handleChange}
              >
                <option value="food">Food</option>
                <option value="grocery">Grocery</option>
                <option value="pharmacy">Pharmacy</option>
                <option value="bakery">Bakery</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="businessStatus">Status</label>
              <select
                id="businessStatus"
                name="businessStatus"
                className="form-input"
                value={form.businessStatus}
                onChange={handleChange}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending_approval">Pending approval</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="icon">Icon (emoji)</label>
              <input
                id="icon"
                name="icon"
                className="form-input"
                value={form.icon}
                onChange={handleChange}
                placeholder="🍽️"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="bannerColor">Banner color</label>
              <input
                id="bannerColor"
                name="bannerColor"
                type="color"
                className="form-input"
                value={form.bannerColor}
                onChange={handleChange}
                style={{ height: 48, padding: 4 }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="offer">Offer badge (optional)</label>
            <input
              id="offer"
              name="offer"
              className="form-input"
              value={form.offer}
              onChange={handleChange}
              placeholder="20% OFF"
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary btn-full" disabled={saving}>
              {saving ? 'Saving…' : 'Save restaurant'}
            </button>
          </div>
        </form>
      </div>

      {toast && <div className="admin-toast">{toast}</div>}
    </>
  );
}

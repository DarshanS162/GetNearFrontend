import { useState } from 'react';
import { useCatalog } from '../../context/CatalogContext';
import ImageField from '../../components/ui/ImageField';
import { uploadImage } from '../../lib/storage';

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

function bizToForm(biz) {
  return {
    name: biz.name || '',
    type: biz.type || '',
    location: biz.location || '',
    description: biz.description || '',
    contactPhone: biz.contactPhone || '',
    contactEmail: biz.contactEmail || '',
    ownerName: biz.ownerName || '',
    ownerPhone: biz.ownerPhone || '',
    gstNumber: biz.gstNumber || '',
    fssaiNumber: biz.fssaiNumber || '',
    deliveryTime: String(biz.deliveryTime || 30),
    freeDeliveryAbove: String(biz.freeDeliveryAbove || 299),
    businessStatus: biz.businessStatus || 'active',
    category: biz.category || 'food',
    icon: biz.icon || '🍽️',
    bannerColor: biz.bannerColor || '#FFF0E8',
    offer: biz.offer || '',
  };
}

export default function AdminRestaurants() {
  const { businesses, addRestaurant, updateRestaurant, deleteRestaurant, slugify } = useCatalog();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [existingBannerUrl, setExistingBannerUrl] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setImageFile(null);
    setExistingBannerUrl('');
    setFormOpen(true);
  }

  function openEdit(biz) {
    setEditingId(biz.id);
    setForm(bizToForm(biz));
    setImageFile(null);
    setExistingBannerUrl(biz.bannerUrl || '');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setImageFile(null);
    setExistingBannerUrl('');
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
      let bannerUrl = existingBannerUrl;
      if (imageFile) {
        bannerUrl = await uploadImage('restaurant-assets', imageFile, 'banners');
      }

      if (editingId) {
        await updateRestaurant(editingId, { ...form, bannerUrl });
        showToast(`Updated "${form.name}"`);
      } else {
        await addRestaurant({ ...form, bannerUrl });
        showToast(`Restaurant "${form.name}" added`);
      }
      closeForm();
    } catch (err) {
      showToast(err.message || 'Failed to save restaurant');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="admin-page-header admin-page-header-row">
        <div>
          <h1>Restaurants</h1>
          <p>Manage restaurants and assign owners who can edit their menu.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openAdd}>
          + Add restaurant
        </button>
      </div>

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
                <td colSpan={5} className="admin-empty">No restaurants yet. Click Add restaurant.</td>
              </tr>
            ) : (
              businesses.map((biz) => (
                <tr key={biz.id}>
                  <td>
                    <span className="admin-table-name">
                      {biz.bannerUrl ? (
                        <img src={biz.bannerUrl} alt="" className="admin-thumb" />
                      ) : (
                        <span>{biz.icon} </span>
                      )}
                      {biz.name}
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
                    <div className="admin-actions">
                      <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(biz)}>
                        Edit
                      </button>
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
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div className="admin-modal-backdrop" onClick={closeForm} role="presentation">
          <div
            className="admin-modal card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="restaurant-form-title"
          >
            <div className="admin-modal-header">
              <h2 id="restaurant-form-title">{editingId ? 'Edit restaurant' : 'Add restaurant'}</h2>
              <button type="button" className="btn-ghost btn-sm" onClick={closeForm}>
                Close
              </button>
            </div>

            <form className="admin-form admin-modal-body" onSubmit={handleSubmit}>
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
                {form.name && !editingId && (
                  <p className="form-hint">Slug: {slugify(form.name)}</p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="type">Cuisine / type</label>
                <input id="type" name="type" className="form-input" value={form.type} onChange={handleChange} placeholder="North Indian, thali" />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="location">Location</label>
                <input id="location" name="location" className="form-input" value={form.location} onChange={handleChange} placeholder="Andheri West, Mumbai" />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="description">Description</label>
                <textarea id="description" name="description" className="form-input" rows={3} value={form.description} onChange={handleChange} style={{ resize: 'vertical' }} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="contactPhone">Phone</label>
                  <input id="contactPhone" name="contactPhone" className="form-input" value={form.contactPhone} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="contactEmail">Email</label>
                  <input id="contactEmail" name="contactEmail" type="email" className="form-input" value={form.contactEmail} onChange={handleChange} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="ownerName">Owner name *</label>
                  <input id="ownerName" name="ownerName" className="form-input" value={form.ownerName} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="ownerPhone">Owner mobile *</label>
                  <input id="ownerPhone" name="ownerPhone" type="tel" className="form-input" value={form.ownerPhone} onChange={handleChange} required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="gstNumber">GST number</label>
                  <input id="gstNumber" name="gstNumber" className="form-input" value={form.gstNumber} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="fssaiNumber">FSSAI number</label>
                  <input id="fssaiNumber" name="fssaiNumber" className="form-input" value={form.fssaiNumber} onChange={handleChange} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="deliveryTime">Delivery time (min)</label>
                  <input id="deliveryTime" name="deliveryTime" type="number" min="5" className="form-input" value={form.deliveryTime} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="freeDeliveryAbove">Free delivery above (₹)</label>
                  <input id="freeDeliveryAbove" name="freeDeliveryAbove" type="number" min="0" className="form-input" value={form.freeDeliveryAbove} onChange={handleChange} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="category">Category</label>
                  <select id="category" name="category" className="form-input" value={form.category} onChange={handleChange}>
                    <option value="food">Food</option>
                    <option value="grocery">Grocery</option>
                    <option value="pharmacy">Pharmacy</option>
                    <option value="bakery">Bakery</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="businessStatus">Status</label>
                  <select id="businessStatus" name="businessStatus" className="form-input" value={form.businessStatus} onChange={handleChange}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending_approval">Pending approval</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="icon">Icon (emoji)</label>
                  <input id="icon" name="icon" className="form-input" value={form.icon} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="bannerColor">Banner color</label>
                  <input id="bannerColor" name="bannerColor" type="color" className="form-input" value={form.bannerColor} onChange={handleChange} style={{ height: 48, padding: 4 }} />
                </div>
              </div>

              {existingBannerUrl && !imageFile && (
                <div className="form-group">
                  <p className="form-label">Current image</p>
                  <img src={existingBannerUrl} alt="" className="admin-current-image" />
                </div>
              )}

              <ImageField
                id="restaurant-image"
                label={editingId ? 'Replace image (optional)' : 'Restaurant image'}
                value={imageFile}
                onChange={setImageFile}
              />

              <div className="form-group">
                <label className="form-label" htmlFor="offer">Offer badge (optional)</label>
                <input id="offer" name="offer" className="form-input" value={form.offer} onChange={handleChange} placeholder="20% OFF" />
              </div>

              <div className="form-actions admin-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save restaurant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <div className="admin-toast">{toast}</div>}
    </>
  );
}

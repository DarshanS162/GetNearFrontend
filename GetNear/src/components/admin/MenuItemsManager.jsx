import { useState } from 'react';
import { useCatalog } from '../../context/CatalogContext';
import ImageField from '../ui/ImageField';
import { uploadImage } from '../../lib/storage';

const emptyForm = {
  businessId: '',
  categoryId: '',
  newCategoryName: '',
  name: '',
  description: '',
  price: '',
  mrp: '',
  foodType: 'veg',
  prepTime: '15',
  ingredients: '',
  isAvailable: true,
};

function itemToForm(item, businessId) {
  return {
    businessId: item.businessId || businessId || '',
    categoryId: item.categoryId || '',
    newCategoryName: '',
    name: item.name || '',
    description: item.description || '',
    price: String(item.price || ''),
    mrp: String(item.mrp || ''),
    foodType: item.foodType || 'veg',
    prepTime: String(item.prepTime || 15),
    ingredients: item.ingredients || '',
    isAvailable: item.isAvailable !== false,
  };
}

/**
 * Shared menu item manager.
 * @param {string} [lockedBusinessId] - Restaurant owner: only their store
 * @param {boolean} [showRestaurantPicker] - Admin: pick any restaurant
 */
export default function MenuItemsManager({
  lockedBusinessId,
  showRestaurantPicker = true,
  title = 'Menu items',
  description = 'Add dishes and products.',
}) {
  const {
    businesses,
    products,
    menuCategories,
    addProduct,
    updateProduct,
    deleteProduct,
  } = useCatalog();

  const allowedBusinesses = lockedBusinessId
    ? businesses.filter((b) => b.id === lockedBusinessId)
    : businesses;

  const defaultBusinessId = lockedBusinessId || businesses[0]?.id || '';

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [existingImageUrl, setExistingImageUrl] = useState('');
  const [form, setForm] = useState({ ...emptyForm, businessId: defaultBusinessId });
  const [filterRestaurant, setFilterRestaurant] = useState(lockedBusinessId || '');
  const [toast, setToast] = useState('');
  const [useNewCategory, setUseNewCategory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);

  const selectedBusinessId = lockedBusinessId || form.businessId;
  const categoriesForRestaurant = menuCategories.filter(
    (c) => !selectedBusinessId || c.restaurantId === selectedBusinessId,
  );

  const scopedProducts = lockedBusinessId
    ? products.filter((p) => p.businessId === lockedBusinessId)
    : products;

  const filteredProducts = filterRestaurant
    ? scopedProducts.filter((p) => p.businessId === filterRestaurant)
    : scopedProducts;

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function openAdd() {
    const businessId = lockedBusinessId || defaultBusinessId;
    setEditingId(null);
    setForm({ ...emptyForm, businessId });
    setUseNewCategory(false);
    setImageFile(null);
    setExistingImageUrl('');
    setFormOpen(true);
  }

  function openEdit(item) {
    setEditingId(item.id);
    setForm(itemToForm(item, lockedBusinessId));
    setUseNewCategory(false);
    setImageFile(null);
    setExistingImageUrl(item.imageUrl || '');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setImageFile(null);
    setExistingImageUrl('');
    setUseNewCategory(false);
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'businessId' ? { categoryId: '' } : {}),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const businessId = lockedBusinessId || form.businessId;
    if (!form.name.trim() || !businessId || !form.price) return;
    if (!useNewCategory && !form.categoryId) return;
    if (useNewCategory && !form.newCategoryName.trim()) return;

    setSaving(true);
    try {
      let imageUrl = existingImageUrl;
      if (imageFile) {
        imageUrl = await uploadImage('product-images', imageFile, businessId);
      }

      const payload = {
        ...form,
        businessId,
        categoryId: useNewCategory ? undefined : form.categoryId,
        newCategoryName: useNewCategory ? form.newCategoryName : undefined,
        imageUrl,
      };

      if (editingId) {
        await updateProduct(editingId, payload);
        showToast(`Updated "${form.name}"`);
      } else {
        await addProduct(payload);
        showToast(`"${form.name}" added to menu`);
      }
      closeForm();
    } catch (err) {
      showToast(err.message || 'Failed to save item');
    } finally {
      setSaving(false);
    }
  }

  function getBusinessName(id) {
    return businesses.find((b) => b.id === id)?.name || id;
  }

  function getCategoryName(id) {
    return menuCategories.find((c) => c.id === id)?.name || id;
  }

  const canAdd = allowedBusinesses.length > 0;

  return (
    <>
      <div className="admin-page-header admin-page-header-row">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openAdd} disabled={!canAdd}>
          + Add menu item
        </button>
      </div>

      {showRestaurantPicker && !lockedBusinessId && (
        <div className="form-group" style={{ marginBottom: 'var(--space-4)', maxWidth: 320 }}>
          <label className="form-label" htmlFor="filter">Filter by restaurant</label>
          <select
            id="filter"
            className="form-input"
            value={filterRestaurant}
            onChange={(e) => setFilterRestaurant(e.target.value)}
          >
            <option value="">All restaurants</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="card admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Item</th>
              {showRestaurantPicker && !lockedBusinessId && <th>Restaurant</th>}
              <th>Price</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={showRestaurantPicker && !lockedBusinessId ? 4 : 3} className="admin-empty">
                  No menu items yet. Click Add menu item.
                </td>
              </tr>
            ) : (
              filteredProducts.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className="admin-table-name">
                      {item.imageUrl && (
                        <img src={item.imageUrl} alt="" className="admin-thumb" />
                      )}
                      {item.name}
                    </span>
                    <span className="admin-table-meta">
                      {getCategoryName(item.categoryId)} · {item.foodType}
                      {!item.isAvailable && ' · unavailable'}
                    </span>
                  </td>
                  {showRestaurantPicker && !lockedBusinessId && (
                    <td>{getBusinessName(item.businessId)}</td>
                  )}
                  <td>
                    <strong>₹{item.price}</strong>
                    {item.mrp > item.price && (
                      <span className="admin-table-meta"> (MRP ₹{item.mrp})</span>
                    )}
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(item)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={async () => {
                          if (window.confirm(`Delete "${item.name}"?`)) {
                            try {
                              await deleteProduct(item.id);
                              showToast(`Deleted ${item.name}`);
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
          >
            <div className="admin-modal-header">
              <h2>{editingId ? 'Edit menu item' : 'Add menu item'}</h2>
              <button type="button" className="btn-ghost btn-sm" onClick={closeForm}>
                Close
              </button>
            </div>

            <form className="admin-form admin-modal-body" onSubmit={handleSubmit}>
              {showRestaurantPicker && !lockedBusinessId && (
                <div className="form-group">
                  <label className="form-label" htmlFor="businessId">Restaurant *</label>
                  <select
                    id="businessId"
                    name="businessId"
                    className="form-input"
                    value={form.businessId}
                    onChange={handleChange}
                    required
                  >
                    <option value="" disabled>Select restaurant</option>
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {lockedBusinessId && (
                <div className="form-group">
                  <label className="form-label">Your restaurant</label>
                  <p className="form-input" style={{ margin: 0, background: 'var(--color-bg)' }}>
                    {getBusinessName(lockedBusinessId)}
                  </p>
                </div>
              )}

              <div className="form-group">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={useNewCategory}
                    onChange={(e) => setUseNewCategory(e.target.checked)}
                  />
                  Create new category
                </label>
              </div>

              {useNewCategory ? (
                <div className="form-group">
                  <label className="form-label" htmlFor="newCategoryName">New category name *</label>
                  <input
                    id="newCategoryName"
                    name="newCategoryName"
                    className="form-input"
                    value={form.newCategoryName}
                    onChange={handleChange}
                    placeholder="Thalis"
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label" htmlFor="categoryId">Category *</label>
                  <select
                    id="categoryId"
                    name="categoryId"
                    className="form-input"
                    value={form.categoryId}
                    onChange={handleChange}
                    required={!useNewCategory}
                  >
                    {categoriesForRestaurant.length === 0 ? (
                      <option value="">Create a category first</option>
                    ) : (
                      categoriesForRestaurant.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))
                    )}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="name">Item name *</label>
                <input id="name" name="name" className="form-input" value={form.name} onChange={handleChange} required />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="description">Description</label>
                <textarea id="description" name="description" className="form-input" rows={2} value={form.description} onChange={handleChange} style={{ resize: 'vertical' }} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="price">Selling price (₹) *</label>
                  <input id="price" name="price" type="number" min="1" className="form-input" value={form.price} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="mrp">MRP (₹)</label>
                  <input id="mrp" name="mrp" type="number" min="1" className="form-input" value={form.mrp} onChange={handleChange} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="foodType">Food type</label>
                  <select id="foodType" name="foodType" className="form-input" value={form.foodType} onChange={handleChange}>
                    <option value="veg">Veg</option>
                    <option value="non_veg">Non veg</option>
                    <option value="egg">Egg</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="prepTime">Prep time (min)</label>
                  <input id="prepTime" name="prepTime" type="number" min="1" className="form-input" value={form.prepTime} onChange={handleChange} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="ingredients">Ingredients</label>
                <textarea id="ingredients" name="ingredients" className="form-input" rows={2} value={form.ingredients} onChange={handleChange} style={{ resize: 'vertical' }} />
              </div>

              {existingImageUrl && !imageFile && (
                <div className="form-group">
                  <p className="form-label">Current image</p>
                  <img src={existingImageUrl} alt="" className="admin-current-image" />
                </div>
              )}

              <ImageField
                id="menu-item-image"
                label={editingId ? 'Replace image (optional)' : 'Item image'}
                value={imageFile}
                onChange={setImageFile}
              />

              <div className="form-group">
                <label className="checkbox-row">
                  <input type="checkbox" name="isAvailable" checked={form.isAvailable} onChange={handleChange} />
                  Available for ordering
                </label>
              </div>

              <div className="form-actions admin-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save menu item'}
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

import { useState } from 'react';
import { useCatalog } from '../../context/CatalogContext';

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
    deleteProduct,
  } = useCatalog();

  const allowedBusinesses = lockedBusinessId
    ? businesses.filter((b) => b.id === lockedBusinessId)
    : businesses;

  const defaultBusinessId = lockedBusinessId || businesses[0]?.id || '';

  const [form, setForm] = useState({
    ...emptyForm,
    businessId: defaultBusinessId,
    categoryId: menuCategories[0]?.id || '',
  });
  const [filterRestaurant, setFilterRestaurant] = useState(lockedBusinessId || '');
  const [toast, setToast] = useState('');
  const [useNewCategory, setUseNewCategory] = useState(false);
  const [saving, setSaving] = useState(false);

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
      await addProduct({
        ...form,
        businessId,
        categoryId: useNewCategory ? undefined : form.categoryId,
        newCategoryName: useNewCategory ? form.newCategoryName : undefined,
      });

      setForm({
        ...emptyForm,
        businessId,
        categoryId: '',
      });
      setUseNewCategory(false);
      showToast(`"${form.name}" added to menu`);
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
      <div className="admin-page-header">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      <div className="admin-grid">
        <div>
          {showRestaurantPicker && !lockedBusinessId && (
            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
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
                      No menu items yet
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="admin-table-name">{item.name}</span>
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
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <form className="card admin-form" onSubmit={handleSubmit}>
          <h2>Add menu item</h2>

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
              {businesses.length === 0 && (
                <p className="form-hint">Add a restaurant first.</p>
              )}
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
            <input
              id="name"
              name="name"
              className="form-input"
              value={form.name}
              onChange={handleChange}
              placeholder="Paneer butter masala"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              className="form-input"
              rows={2}
              value={form.description}
              onChange={handleChange}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="price">Selling price (₹) *</label>
              <input
                id="price"
                name="price"
                type="number"
                min="1"
                className="form-input"
                value={form.price}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="mrp">MRP (₹)</label>
              <input
                id="mrp"
                name="mrp"
                type="number"
                min="1"
                className="form-input"
                value={form.mrp}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="foodType">Food type</label>
              <select
                id="foodType"
                name="foodType"
                className="form-input"
                value={form.foodType}
                onChange={handleChange}
              >
                <option value="veg">Veg</option>
                <option value="non_veg">Non veg</option>
                <option value="egg">Egg</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="prepTime">Prep time (min)</label>
              <input
                id="prepTime"
                name="prepTime"
                type="number"
                min="1"
                className="form-input"
                value={form.prepTime}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="ingredients">Ingredients</label>
            <textarea
              id="ingredients"
              name="ingredients"
              className="form-input"
              rows={2}
              value={form.ingredients}
              onChange={handleChange}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="form-group">
            <label className="checkbox-row">
              <input
                type="checkbox"
                name="isAvailable"
                checked={form.isAvailable}
                onChange={handleChange}
              />
              Available for ordering
            </label>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={!canAdd || saving}
            >
              {saving ? 'Saving…' : 'Save menu item'}
            </button>
          </div>
        </form>
      </div>

      {toast && <div className="admin-toast">{toast}</div>}
    </>
  );
}

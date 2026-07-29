import { useMemo, useState } from 'react';
import { useCatalog } from '../../context/CatalogContext';
import './MenuItemsManager.css';

const CATEGORY_SUGGESTIONS = [
  'Starters',
  'Main course',
  'Breads',
  'Rice & biryani',
  'Thalis',
  'Beverages',
  'Desserts',
];

/**
 * Separate modal to add / remove restaurant menu categories.
 */
export default function CategoryManagerModal({
  businessId,
  businesses = [],
  showRestaurantPicker = false,
  onClose,
  onCategoryAdded,
}) {
  const { menuCategories, products, addCategory, deleteCategory } = useCatalog();
  const [selectedBusinessId, setSelectedBusinessId] = useState(businessId || businesses[0]?.id || '');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState('');

  const activeBusinessId = businessId || selectedBusinessId;

  const categories = useMemo(
    () => menuCategories.filter((c) => c.restaurantId === activeBusinessId),
    [menuCategories, activeBusinessId],
  );

  const unusedSuggestions = CATEGORY_SUGGESTIONS.filter(
    (suggestion) =>
      !categories.some((c) => c.name.trim().toLowerCase() === suggestion.toLowerCase()),
  );

  function itemCount(categoryId) {
    return products.filter((p) => p.categoryId === categoryId).length;
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!activeBusinessId) {
      setError('Select a restaurant first');
      return;
    }
    if (!name.trim()) {
      setError('Enter a category name');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const id = await addCategory(activeBusinessId, name.trim());
      setName('');
      onCategoryAdded?.(id);
    } catch (err) {
      setError(err.message || 'Could not add category');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(category) {
    const count = itemCount(category.id);
    if (count > 0) {
      setError(`“${category.name}” has ${count} item${count === 1 ? '' : 's'}. Move or delete them first.`);
      return;
    }
    if (!window.confirm(`Remove category “${category.name}”?`)) return;

    setRemovingId(category.id);
    setError('');
    try {
      await deleteCategory(category.id);
    } catch (err) {
      setError(err.message || 'Could not remove category');
    } finally {
      setRemovingId('');
    }
  }

  return (
    <div className="admin-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="admin-modal card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-manager-title"
      >
        <div className="admin-modal-header">
          <h2 id="category-manager-title">Manage categories</h2>
          <button type="button" className="btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="admin-form admin-modal-body">
          {showRestaurantPicker && !businessId && (
            <div className="form-group">
              <label className="form-label" htmlFor="category-manager-restaurant">
                Restaurant
              </label>
              <select
                id="category-manager-restaurant"
                className="form-input"
                value={selectedBusinessId}
                onChange={(e) => {
                  setSelectedBusinessId(e.target.value);
                  setError('');
                }}
              >
                <option value="" disabled>
                  Select restaurant
                </option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <form className="menu-category-manager-add" onSubmit={handleAdd}>
            <label className="form-label" htmlFor="category-manager-name">
              Add category
            </label>
            <div className="menu-category-manager-row">
              <input
                id="category-manager-name"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Starters, Thalis"
                disabled={!activeBusinessId || busy}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!activeBusinessId || busy || !name.trim()}
              >
                {busy ? 'Adding…' : 'Add'}
              </button>
            </div>
          </form>

          {unusedSuggestions.length > 0 && (
            <div className="menu-category-suggestions" role="group" aria-label="Suggested categories">
              {unusedSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="chip"
                  disabled={!activeBusinessId || busy}
                  onClick={() => setName(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {error && <p className="menu-category-manager-error">{error}</p>}

          <p className="menu-category-manager-list-label">Your categories</p>

          {categories.length === 0 ? (
            <div className="menu-category-empty">
              <p className="menu-category-empty-title">No categories yet</p>
              <p className="form-hint">Add sections like Starters or Beverages, then assign items to them.</p>
            </div>
          ) : (
            <ul className="menu-category-manager-list">
              {categories.map((category) => {
                const count = itemCount(category.id);
                return (
                  <li key={category.id} className="menu-category-manager-item">
                    <div>
                      <strong>{category.name}</strong>
                      <span>
                        {count} item{count === 1 ? '' : 's'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn-danger btn-sm"
                      disabled={removingId === category.id}
                      onClick={() => handleRemove(category)}
                    >
                      {removingId === category.id ? 'Removing…' : 'Remove'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="form-actions admin-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

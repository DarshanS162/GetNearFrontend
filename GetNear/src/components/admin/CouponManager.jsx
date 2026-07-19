import { useCallback, useEffect, useMemo, useState } from 'react';
import { couponUseCases } from '../../application/container';
import { couponDiscountLabel } from '../../domain/coupon';
import { useCatalog } from '../../context/CatalogContext';
import './CouponManager.css';

function localDate(value) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function emptyForm(ownerType, restaurantId) {
  return {
    id: '',
    ownerType,
    restaurantId: restaurantId || '',
    code: '',
    title: '',
    description: '',
    scope: ownerType === 'business' ? 'business' : 'platform',
    discountType: 'percentage',
    discountValue: '10',
    minOrderAmount: '0',
    maxDiscountAmount: '',
    usageLimit: '',
    perUserLimit: '1',
    validFrom: localDate(new Date()),
    validUntil: '',
    audience: 'all',
    firstOrderOnly: false,
    isRewardOnly: false,
    buyQuantity: '',
    getQuantity: '',
    isActive: true,
    targets: { businesses: [], categories: [], products: [] },
  };
}

function couponToForm(coupon) {
  return {
    ...coupon,
    discountValue: String(coupon.discountValue),
    minOrderAmount: String(coupon.minOrderAmount),
    maxDiscountAmount:
      coupon.maxDiscountAmount == null ? '' : String(coupon.maxDiscountAmount),
    usageLimit: coupon.usageLimit == null ? '' : String(coupon.usageLimit),
    perUserLimit: String(coupon.perUserLimit),
    validFrom: localDate(coupon.validFrom),
    validUntil: localDate(coupon.validUntil),
    buyQuantity: coupon.buyQuantity == null ? '' : String(coupon.buyQuantity),
    getQuantity: coupon.getQuantity == null ? '' : String(coupon.getQuantity),
  };
}

export default function CouponManager({
  ownerType,
  lockedRestaurantId = '',
  title = 'Coupons',
}) {
  const { businesses, menuCategories, products } = useCatalog();
  const [coupons, setCoupons] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [form, setForm] = useState(() => emptyForm(ownerType, lockedRestaurantId));
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const couponRows = await couponUseCases.manage.list({
          restaurantId: lockedRestaurantId,
          ownerType: ownerType === 'business' ? 'business' : '',
        });
      setCoupons(couponRows);
      if (ownerType === 'platform') {
        setRedemptions(await couponUseCases.manage.listRedemptions());
      }
    } catch (err) {
      setError(err.message || 'Could not load coupons');
    } finally {
      setLoading(false);
    }
  }, [lockedRestaurantId, ownerType]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const targetRestaurantId =
    lockedRestaurantId || form.restaurantId || form.targets.businesses[0] || '';
  const availableCategories = useMemo(
    () =>
      menuCategories.filter(
        (category) =>
          !targetRestaurantId || category.restaurantId === targetRestaurantId,
      ),
    [menuCategories, targetRestaurantId],
  );
  const availableProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          !targetRestaurantId || product.businessId === targetRestaurantId,
      ),
    [products, targetRestaurantId],
  );

  function update(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  function toggleTarget(group, id) {
    setForm((current) => {
      const selected = current.targets[group];
      return {
        ...current,
        targets: {
          ...current.targets,
          [group]: selected.includes(id)
            ? selected.filter((value) => value !== id)
            : [...selected, id],
        },
      };
    });
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await couponUseCases.manage.save({
        ...form,
        restaurantId: lockedRestaurantId || form.restaurantId,
        validFrom: new Date(form.validFrom).toISOString(),
        validUntil: form.validUntil
          ? new Date(form.validUntil).toISOString()
          : '',
      });
      setFormOpen(false);
      setForm(emptyForm(ownerType, lockedRestaurantId));
      await refresh();
    } catch (err) {
      setError(err.message || 'Could not save coupon');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(coupon) {
    try {
      await couponUseCases.manage.setActive(coupon.id, !coupon.isActive);
      await refresh();
    } catch (err) {
      setError(err.message || 'Could not update coupon');
    }
  }

  async function remove(coupon) {
    if (!window.confirm(`Delete coupon ${coupon.code}?`)) return;
    try {
      await couponUseCases.manage.remove(coupon.id);
      await refresh();
    } catch (err) {
      setError(err.message || 'Could not delete coupon');
    }
  }

  return (
    <div>
      <div className="admin-page-header coupon-page-header">
        <div>
          <h1>{title}</h1>
          <p>Create reusable discounts and track their performance.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setForm(emptyForm(ownerType, lockedRestaurantId));
            setFormOpen(true);
          }}
        >
          Create coupon
        </button>
      </div>

      {error && <div className="coupon-alert">{error}</div>}
      {loading && <p>Loading coupons…</p>}

      {!loading && (
        <>
          <div className="coupon-grid">
            {coupons.map((coupon) => (
            <article className="card coupon-admin-card" key={coupon.id}>
              <div className="coupon-admin-top">
                <div>
                  <span className="coupon-code">{coupon.code}</span>
                  <h3>{coupon.title || couponDiscountLabel(coupon)}</h3>
                </div>
                <span className={`badge ${coupon.isActive ? 'badge-success' : ''}`}>
                  {coupon.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p>{couponDiscountLabel(coupon)} · {coupon.scope}</p>
              <div className="coupon-stats">
                <span><strong>{coupon.usageCount}</strong> redemptions</span>
                <span><strong>₹{coupon.totalDiscount.toFixed(0)}</strong> discount</span>
              </div>
              <div className="admin-actions">
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    setForm(couponToForm(coupon));
                    setFormOpen(true);
                  }}
                >
                  Edit
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => toggle(coupon)}>
                  {coupon.isActive ? 'Disable' : 'Enable'}
                </button>
                <button type="button" className="btn-danger" onClick={() => remove(coupon)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
            {coupons.length === 0 && (
              <div className="card coupon-empty">No coupons created yet.</div>
            )}
          </div>

          {ownerType === 'platform' && (
            <>
              <h2 className="admin-section-title" style={{ marginTop: 32 }}>
                Redemption history
              </h2>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Coupon</th>
                      <th>Customer</th>
                      <th>Order</th>
                      <th>Discount</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {redemptions.map((item) => (
                      <tr key={item.id}>
                        <td>{item.coupons?.code || '—'}</td>
                        <td>{item.users?.full_name || item.users?.phone || '—'}</td>
                        <td>{item.orders?.order_number || '—'}</td>
                        <td>₹{Number(item.discount_applied).toFixed(0)}</td>
                        <td>{new Date(item.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {redemptions.length === 0 && (
                  <div className="coupon-empty">No redemptions yet.</div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {formOpen && (
        <div className="modal-overlay" onClick={() => setFormOpen(false)}>
          <div className="modal coupon-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>{form.id ? 'Edit coupon' : 'Create coupon'}</h2>
              <button type="button" onClick={() => setFormOpen(false)}>×</button>
            </div>
            <form onSubmit={save}>
              <div className="coupon-form-grid">
                <label>
                  Code
                  <input className="form-input" name="code" value={form.code} onChange={update} required />
                </label>
                <label>
                  Campaign title
                  <input className="form-input" name="title" value={form.title} onChange={update} />
                </label>

                {ownerType === 'platform' && (
                  <label>
                    Coupon ownership
                    <select className="form-input" name="ownerType" value={form.ownerType} onChange={update}>
                      <option value="platform">Platform</option>
                      <option value="business">Business</option>
                    </select>
                  </label>
                )}

                {form.ownerType === 'business' && !lockedRestaurantId && (
                  <label>
                    Business
                    <select className="form-input" name="restaurantId" value={form.restaurantId} onChange={update} required>
                      <option value="">Select business</option>
                      {businesses.map((business) => (
                        <option key={business.id} value={business.id}>{business.name}</option>
                      ))}
                    </select>
                  </label>
                )}

                <label>
                  Applies to
                  <select className="form-input" name="scope" value={form.scope} onChange={update}>
                    {form.ownerType === 'platform' && <option value="platform">Platform / selected businesses</option>}
                    <option value="order">Entire order</option>
                    <option value="business">Entire business</option>
                    <option value="category">Selected categories</option>
                    <option value="product">Selected products</option>
                  </select>
                </label>
                <label>
                  Discount type
                  <select className="form-input" name="discountType" value={form.discountType} onChange={update}>
                    <option value="percentage">Percentage</option>
                    <option value="flat">Flat amount</option>
                    <option value="free_delivery">Free delivery</option>
                    <option value="buy_x_get_y" disabled>Buy X Get Y (coming soon)</option>
                  </select>
                </label>
                {!['free_delivery', 'buy_x_get_y'].includes(form.discountType) && (
                  <label>
                    Discount value
                    <input className="form-input" type="number" min="0" name="discountValue" value={form.discountValue} onChange={update} required />
                  </label>
                )}
                <label>
                  Minimum order (₹)
                  <input className="form-input" type="number" min="0" name="minOrderAmount" value={form.minOrderAmount} onChange={update} />
                </label>
                <label>
                  Maximum discount (₹)
                  <input className="form-input" type="number" min="0" name="maxDiscountAmount" value={form.maxDiscountAmount} onChange={update} />
                </label>
                <label>
                  Total redemption limit
                  <input className="form-input" type="number" min="1" name="usageLimit" value={form.usageLimit} onChange={update} placeholder="Unlimited" />
                </label>
                <label>
                  Limit per user
                  <input className="form-input" type="number" min="1" name="perUserLimit" value={form.perUserLimit} onChange={update} />
                </label>
                <label>
                  Audience
                  <select className="form-input" name="audience" value={form.audience} onChange={update}>
                    <option value="all">All users</option>
                    <option value="new_users">New users</option>
                    <option value="existing_users">Existing users</option>
                  </select>
                </label>
                <label>
                  Starts
                  <input className="form-input" type="datetime-local" name="validFrom" value={form.validFrom} onChange={update} required />
                </label>
                <label>
                  Ends
                  <input className="form-input" type="datetime-local" name="validUntil" value={form.validUntil} onChange={update} />
                </label>
              </div>

              {form.ownerType === 'platform' && form.scope === 'platform' && (
                <fieldset className="coupon-targets">
                  <legend>Businesses (none selected = all)</legend>
                  {businesses.map((business) => (
                    <label key={business.id}>
                      <input type="checkbox" checked={form.targets.businesses.includes(business.id)} onChange={() => toggleTarget('businesses', business.id)} />
                      {business.name}
                    </label>
                  ))}
                </fieldset>
              )}
              {form.scope === 'category' && (
                <fieldset className="coupon-targets">
                  <legend>Eligible categories</legend>
                  {availableCategories.map((category) => (
                    <label key={category.id}>
                      <input type="checkbox" checked={form.targets.categories.includes(category.id)} onChange={() => toggleTarget('categories', category.id)} />
                      {category.name}
                    </label>
                  ))}
                </fieldset>
              )}
              {form.scope === 'product' && (
                <fieldset className="coupon-targets">
                  <legend>Eligible products</legend>
                  {availableProducts.map((product) => (
                    <label key={product.id}>
                      <input type="checkbox" checked={form.targets.products.includes(product.id)} onChange={() => toggleTarget('products', product.id)} />
                      {product.name}
                    </label>
                  ))}
                </fieldset>
              )}

              <div className="coupon-switches">
                <label><input type="checkbox" name="firstOrderOnly" checked={form.firstOrderOnly} onChange={update} /> First order only</label>
                {ownerType === 'platform' && (
                  <label><input type="checkbox" name="isRewardOnly" checked={form.isRewardOnly} onChange={update} /> Referral reward only</label>
                )}
                <label><input type="checkbox" name="isActive" checked={form.isActive} onChange={update} /> Active</label>
              </div>

              <label>
                Description
                <textarea className="form-input" name="description" value={form.description} onChange={update} rows="3" />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save coupon'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

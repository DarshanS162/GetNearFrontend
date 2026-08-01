import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { createId, normalizePhone } from '../../lib/utils';

const emptyForm = {
  fullName: '',
  phone: '',
  email: '',
  isActive: true,
};

function rowToCustomer(row) {
  return {
    id: row.id,
    fullName: row.full_name || '',
    phone: normalizePhone(row.phone),
    email: row.email || '',
    isActive: row.is_active !== false,
    referralCode: row.referral_code || '',
    createdAt: row.created_at,
    roleSlug: row.roles?.slug || 'customer',
  };
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [customerRoleId, setCustomerRoleId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: role, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('slug', 'customer')
        .is('deleted_at', null)
        .maybeSingle();

      if (roleError) throw roleError;
      if (!role?.id) throw new Error('Customer role missing — run migrations');
      setCustomerRoleId(role.id);

      const { data, error: listError } = await supabase
        .from('users')
        .select(
          'id, full_name, phone, email, is_active, referral_code, created_at, role_id, roles(slug, name)',
        )
        .eq('role_id', role.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (listError) throw listError;
      setCustomers((data || []).map(rowToCustomer));
    } catch (err) {
      setError(err.message || 'Failed to load customers');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      return (
        c.fullName.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.referralCode.toLowerCase().includes(q)
      );
    });
  }, [customers, search]);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(customer) {
    setEditingId(customer.id);
    setForm({
      fullName: customer.fullName,
      phone: customer.phone,
      email: customer.email,
      isActive: customer.isActive,
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
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
    const fullName = form.fullName.trim();
    const phone = normalizePhone(form.phone);
    const email = form.email.trim();

    if (!fullName) {
      showToast('Name is required');
      return;
    }
    if (phone.length !== 10) {
      showToast('Phone must be 10 digits');
      return;
    }
    if (!customerRoleId) {
      showToast('Customer role not loaded');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const { error: updateError } = await supabase
          .from('users')
          .update({
            full_name: fullName,
            phone,
            email: email || null,
            is_active: form.isActive,
            role_id: customerRoleId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (updateError) throw updateError;
        showToast(`Updated "${fullName}"`);
      } else {
        const { data: existing } = await supabase
          .from('users')
          .select('id, phone')
          .is('deleted_at', null);

        const dup = (existing || []).find(
          (u) => normalizePhone(u.phone) === phone,
        );
        if (dup) {
          throw new Error('A user with this phone already exists');
        }

        const { error: insertError } = await supabase.from('users').insert({
          auth_user_uuid: createId(),
          role_id: customerRoleId,
          full_name: fullName,
          phone,
          email: email || null,
          is_active: form.isActive,
        });

        if (insertError) throw insertError;
        showToast(`Customer "${fullName}" added`);
      }

      closeForm();
      await loadCustomers();
    } catch (err) {
      showToast(err.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  }

  async function handleDisable(customer) {
    try {
      const { error: err } = await supabase
        .from('users')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customer.id);

      if (err) throw err;
      showToast(`Disabled ${customer.fullName}`);
      await loadCustomers();
    } catch (err) {
      showToast(err.message || 'Could not disable customer');
    }
  }

  async function handleEnable(customer) {
    try {
      const { error: err } = await supabase
        .from('users')
        .update({
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customer.id);

      if (err) throw err;
      showToast(`Enabled ${customer.fullName}`);
      await loadCustomers();
    } catch (err) {
      showToast(err.message || 'Could not enable customer');
    }
  }

  async function handleDeletePermanent(customer) {
    const ok = window.confirm(
      `Permanently delete "${customer.fullName}"?\n\nThey will be removed from the customer list. Order history (if any) is kept without their personal details.`,
    );
    if (!ok) return;

    try {
      const { data, error: err } = await supabase.rpc('admin_delete_customer', {
        p_user_id: customer.id,
      });
      if (err) throw err;
      showToast(
        data === 'anonymized'
          ? `${customer.fullName} removed (order history kept anonymously)`
          : `Permanently deleted ${customer.fullName}`,
      );
      await loadCustomers();
    } catch (err) {
      showToast(err.message || 'Permanent delete failed');
    }
  }

  return (
    <>
      <div className="admin-page-header admin-page-header-row">
        <div>
          <h1>Customers</h1>
          <p>View and manage customer accounts. Disable to block access, or delete permanently to remove them from this list.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openAdd}>
          + Add customer
        </button>
      </div>

      <div className="form-group" style={{ marginBottom: 16, maxWidth: 360 }}>
        <label className="form-label" htmlFor="customer-search">
          Search
        </label>
        <input
          id="customer-search"
          className="form-input"
          type="search"
          placeholder="Name, phone, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className="admin-toast" style={{ position: 'static', marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="card admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Referral</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="admin-empty">
                  Loading customers…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="admin-empty">
                  {search.trim()
                    ? 'No customers match your search.'
                    : 'No customers yet. Click Add customer.'}
                </td>
              </tr>
            ) : (
              filtered.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <span className="admin-table-name">{customer.fullName}</span>
                    {customer.email && (
                      <span className="admin-table-meta">{customer.email}</span>
                    )}
                  </td>
                  <td>{customer.phone || '—'}</td>
                  <td>
                    <span
                      className={`badge ${
                        customer.isActive ? 'badge-success' : 'badge-primary'
                      }`}
                    >
                      {customer.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <span className="admin-table-meta">
                      {customer.referralCode || '—'}
                    </span>
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={() => openEdit(customer)}
                      >
                        Edit
                      </button>
                      {customer.isActive ? (
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          onClick={() => handleDisable(customer)}
                        >
                          Disable
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          onClick={() => handleEnable(customer)}
                        >
                          Enable
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => handleDeletePermanent(customer)}
                      >
                        Delete permanently
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
        <div
          className="admin-modal-backdrop"
          onClick={closeForm}
          role="presentation"
        >
          <div
            className="admin-modal card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="admin-modal-header">
              <h2>{editingId ? 'Edit customer' : 'Add customer'}</h2>
              <button type="button" className="btn-ghost btn-sm" onClick={closeForm}>
                Close
              </button>
            </div>

            <form className="admin-form admin-modal-body" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="fullName">
                  Full name *
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  className="form-input"
                  value={form.fullName}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="phone">
                    Mobile *
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    className="form-input"
                    placeholder="9876543210"
                    value={form.phone}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="form-input"
                    value={form.email}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={form.isActive}
                    onChange={handleChange}
                  />
                  Active account
                </label>
              </div>

              <div className="form-actions admin-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add customer'}
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

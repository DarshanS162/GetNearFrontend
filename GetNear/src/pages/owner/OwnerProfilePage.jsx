import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './OwnerLayout.css';

export default function OwnerProfilePage() {
  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    setFullName(user?.fullName || '');
    setPhone(user?.phone || '');
  }, [user?.fullName, user?.phone]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await updateProfile({ fullName, phone });
      if (result.error) {
        showToast(result.error);
        return;
      }
      showToast('Profile saved');
    } catch (err) {
      showToast(err.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const initial = (user?.fullName || 'O').trim().charAt(0).toUpperCase();

  return (
    <div className="owner-profile-page">
      <div className="admin-page-header">
        <h1>Profile</h1>
        <p>Your account details for the owner panel.</p>
      </div>

      <section className="card owner-settings-section owner-profile-card">
        <div className="owner-profile-avatar" aria-hidden="true">
          {initial}
        </div>
        <div>
          <strong className="owner-profile-name">{user?.fullName || 'Partner'}</strong>
          <p className="owner-profile-role">Restaurant owner</p>
        </div>
      </section>

      <section className="card owner-settings-section">
        <div className="owner-settings-section-head">
          <div>
            <h2>Account details</h2>
            <p>Update your name and phone number.</p>
          </div>
        </div>

        <form className="owner-settings-form" onSubmit={handleSave}>
          <label className="form-label owner-settings-field">
            Full name *
            <input
              className="form-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              required
              autoComplete="name"
            />
          </label>

          <label className="form-label owner-settings-field">
            Phone *
            <div className="owner-profile-phone">
              <span>+91</span>
              <input
                className="form-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile"
                inputMode="numeric"
                required
                autoComplete="tel"
              />
            </div>
          </label>

          <button type="submit" className="btn btn-primary btn-full" disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </section>

      <section className="card owner-settings-section">
        <Link to="/set-password?next=/owner/profile" className="owner-profile-link">
          <span>Set / change password</span>
        </Link>
        <Link to="/?view=customer" className="owner-profile-link">
          <span>Open customer app</span>
        </Link>
      </section>

      <button
        type="button"
        className="btn btn-secondary btn-full owner-profile-logout"
        onClick={handleLogout}
      >
        Logout
      </button>

      {toast && <div className="admin-toast">{toast}</div>}
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar';
import { IconBack } from '../../components/ui/Icons';
import { useAuth } from '../../context/AuthContext';
import { partnerUseCases } from '../../application/container';
import { supabase } from '../../lib/supabase';
import './PartnerApplyPage.css';

function PartnerGuestLanding() {
  return (
    <div className="app-shell animate-in">
      <Navbar showLocation={false} />
      <main className="page-container partner-page">
        <div className="page-header">
          <Link to="/" className="back-btn" aria-label="Go back">
            <IconBack />
          </Link>
          <h1>Partner with GetNear</h1>
        </div>

        <div className="card partner-landing">
          <p className="partner-lead">
            Register your restaurant on GetNear. After you apply, your store stays
            <strong> inactive </strong>
            until our admin team verifies and activates it.
          </p>

          <ol className="partner-steps">
            <li>Login or create an account with your mobile number</li>
            <li>Submit restaurant details for review</li>
            <li>Wait for admin approval — store is not live yet</li>
            <li>Once approved, open your owner dashboard and go live</li>
          </ol>

          <div className="partner-success-actions">
            <Link to="/login?redirect=/partner" className="btn btn-primary">
              Login
            </Link>
            <Link to="/signup?redirect=/partner" className="btn btn-secondary">
              Create account
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function PartnerApplyInner() {
  const { user, syncSession } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    restaurantName: '',
    ownerName: user?.fullName || '',
    phone: user?.phone || '',
    location: '',
    cuisine: '',
    description: '',
    gstNumber: '',
    fssaiNumber: '',
    contactEmail: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await partnerUseCases.submit.execute(form);
      const { data } = await supabase.auth.getSession();
      if (syncSession) await syncSession(data.session);
      setDone(true);
    } catch (err) {
      setError(err.message || 'Could not submit application');
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="app-shell animate-in">
        <Navbar showLocation={false} />
        <main className="page-container partner-page">
          <div className="card partner-success">
            <h1>Application submitted</h1>
            <p>
              Your restaurant is <strong>inactive</strong> and pending admin
              verification. Customers cannot see it until we approve and activate
              your store.
            </p>
            <div className="partner-success-actions">
              <button type="button" className="btn btn-primary" onClick={() => navigate('/owner')}>
                Go to owner panel
              </button>
              <Link to="/?view=customer" className="btn btn-secondary">
                Back home
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell animate-in">
      <Navbar showLocation={false} />
      <main className="page-container partner-page">
        <div className="page-header">
          <Link to="/?view=customer" className="back-btn" aria-label="Go back">
            <IconBack />
          </Link>
          <h1>Partner with GetNear</h1>
        </div>

        <p className="partner-lead">
          Fill in your restaurant details. Your listing stays
          <strong> inactive </strong>
          until GetNear admin verifies and activates it.
        </p>

        <form className="card partner-form" onSubmit={handleSubmit}>
          {error && <p className="form-error">{error}</p>}

          <label className="form-label">
            Restaurant name *
            <input name="restaurantName" className="form-input" value={form.restaurantName} onChange={handleChange} required />
          </label>

          <div className="form-row">
            <label className="form-label">
              Owner name *
              <input name="ownerName" className="form-input" value={form.ownerName} onChange={handleChange} required />
            </label>
            <label className="form-label">
              Mobile *
              <input name="phone" className="form-input" value={form.phone} onChange={handleChange} required />
            </label>
          </div>

          <div className="form-row">
            <label className="form-label">
              Area / locality
              <input name="location" className="form-input" value={form.location} onChange={handleChange} placeholder="Andheri West" />
            </label>
            <label className="form-label">
              Cuisine
              <input name="cuisine" className="form-input" value={form.cuisine} onChange={handleChange} placeholder="North Indian" />
            </label>
          </div>

          <label className="form-label">
            Description
            <textarea name="description" className="form-input" rows={3} value={form.description} onChange={handleChange} />
          </label>

          <div className="form-row">
            <label className="form-label">
              GST number
              <input name="gstNumber" className="form-input" value={form.gstNumber} onChange={handleChange} />
            </label>
            <label className="form-label">
              FSSAI number
              <input name="fssaiNumber" className="form-input" value={form.fssaiNumber} onChange={handleChange} />
            </label>
          </div>

          <label className="form-label">
            Contact email
            <input name="contactEmail" type="email" className="form-input" value={form.contactEmail} onChange={handleChange} />
          </label>

          <button type="submit" className="btn btn-primary btn-full" disabled={saving}>
            {saving ? 'Submitting…' : 'Submit for admin verification'}
          </button>
        </form>
      </main>
    </div>
  );
}

export default function PartnerApplyPage() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-shell">
        <Navbar showLocation={false} />
        <main className="page-container partner-page">
          <p className="partner-lead">Loading…</p>
        </main>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <PartnerGuestLanding />;
  }

  return <PartnerApplyInner />;
}

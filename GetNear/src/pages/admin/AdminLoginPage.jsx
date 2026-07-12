import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Logo } from '../../components/ui/Logo';
import { useAuth } from '../../context/AuthContext';
import '../AuthPages.css';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { isAdmin, loading, loginWithPassword, logout, authError, setAuthError } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && isAdmin) navigate('/admin', { replace: true });
  }, [isAdmin, loading, navigate]);

  async function handleLogin() {
    setBusy(true);
    setAuthError('');
    const result = await loginWithPassword(phone, password);
    setBusy(false);
    if (result.error) return;

    if (result.user?.role !== 'admin' && result.user?.role !== 'super_admin') {
      setAuthError('This number is not registered as an admin.');
      await logout();
      return;
    }
    navigate('/admin');
  }

  return (
    <div className="app-shell auth-page animate-in">
      <main className="auth-container">
        <Logo />
        <span className="admin-login-badge">Admin portal</span>
        <h1>Admin login</h1>
        <p className="auth-subtitle">Sign in with mobile number and password</p>

        <label className="form-label" htmlFor="admin-phone">Mobile number</label>
        <div className="phone-input-row">
          <span className="country-code">+91</span>
          <input
            id="admin-phone"
            type="tel"
            className="form-input"
            placeholder="8668879497"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <label className="form-label" htmlFor="admin-password">Password</label>
        <input
          id="admin-password"
          type="password"
          className="form-input auth-password-input"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleLogin();
          }}
        />

        {authError && <p className="auth-error">{authError}</p>}

        <button type="button" className="btn btn-primary btn-full" onClick={handleLogin} disabled={busy}>
          {busy ? 'Signing in…' : 'Log in'}
        </button>

        <p className="auth-hint">
          Phone <strong>8668879497</strong> or <strong>9552489313</strong>,
          password <strong>GetNear@123</strong>
        </p>

        <p className="auth-footer">
          <Link to="/">← Back to customer app</Link>
        </p>
      </main>
    </div>
  );
}

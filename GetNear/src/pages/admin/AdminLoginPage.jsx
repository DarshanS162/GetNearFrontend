import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Logo } from '../../components/ui/Logo';
import { useAuth } from '../../context/AuthContext';
import { PENDING_PHONE_KEY } from '../AuthPages';
import '../AuthPages.css';

export const ADMIN_LOGIN_FLOW = 'admin';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (isAdmin) navigate('/admin', { replace: true });
  }, [isAdmin, navigate]);

  function handleSendOtp() {
    const trimmed = phone.trim();
    if (trimmed.replace(/\D/g, '').length < 10) return;
    sessionStorage.setItem(PENDING_PHONE_KEY, trimmed);
    sessionStorage.setItem('getnear-auth-flow', ADMIN_LOGIN_FLOW);
    navigate('/otp?flow=admin');
  }

  return (
    <div className="app-shell auth-page animate-in">
      <main className="auth-container">
        <Logo />
        <span className="admin-login-badge">Admin portal</span>
        <h1>Admin login</h1>
        <p className="auth-subtitle">
          Sign in with your registered admin mobile number
        </p>

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
            autoComplete="tel"
          />
        </div>

        <button
          type="button"
          className="btn btn-primary btn-full"
          onClick={handleSendOtp}
        >
          Send OTP
        </button>

        <p className="auth-footer">
          <Link to="/">← Back to customer app</Link>
        </p>
      </main>
    </div>
  );
}

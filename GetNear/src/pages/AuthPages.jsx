import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { Logo } from '../components/ui/Logo';
import { useAuth, getPostLoginPath, resolveUserFromPhone } from '../context/AuthContext';
import { useCatalog } from '../context/CatalogContext';
import { ADMIN_LOGIN_FLOW } from './admin/AdminLoginPage';
import './AuthPages.css';

const PENDING_PHONE_KEY = 'getnear-pending-phone';
const AUTH_FLOW_KEY = 'getnear-auth-flow';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [phone, setPhone] = useState('');

  function handleSendOtp() {
    const trimmed = phone.trim();
    if (trimmed.replace(/\D/g, '').length < 10) return;
    sessionStorage.setItem(PENDING_PHONE_KEY, trimmed);
    sessionStorage.removeItem(AUTH_FLOW_KEY);
    const redirect = searchParams.get('redirect');
    navigate(redirect ? `/otp?redirect=${encodeURIComponent(redirect)}` : '/otp');
  }

  return (
    <div className="app-shell auth-page animate-in">
      <main className="auth-container">
        <Logo />
        <h1>Welcome back</h1>
        <p className="auth-subtitle">Log in to order from nearby stores</p>

        <label className="form-label" htmlFor="phone">Mobile number</label>
        <div className="phone-input-row">
          <span className="country-code">+91</span>
          <input
            id="phone"
            type="tel"
            className="form-input"
            placeholder="8668879497"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
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
          New customer? <Link to="/signup">Create an account</Link>
        </p>
      </main>
    </div>
  );
}

export function SignupPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');

  function handleSendOtp() {
    if (phone.trim().replace(/\D/g, '').length < 10) return;
    sessionStorage.setItem(PENDING_PHONE_KEY, phone.trim());
    navigate('/otp');
  }

  return (
    <div className="app-shell auth-page animate-in">
      <main className="auth-container">
        <Logo />
        <h1>Create account</h1>
        <p className="auth-subtitle">Join GetNear and order from local stores</p>

        <label className="form-label" htmlFor="name">Full name</label>
        <input id="name" type="text" className="form-input" placeholder="Your name" />

        <label className="form-label" htmlFor="signup-phone">Mobile number</label>
        <div className="phone-input-row">
          <span className="country-code">+91</span>
          <input
            id="signup-phone"
            type="tel"
            className="form-input"
            placeholder="9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <button type="button" className="btn btn-primary btn-full" onClick={handleSendOtp}>
          Send OTP
        </button>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </main>
    </div>
  );
}

export function OtpPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const { businesses } = useCatalog();
  const pendingPhone = sessionStorage.getItem(PENDING_PHONE_KEY) || '';
  const isAdminFlow =
    searchParams.get('flow') === 'admin' ||
    sessionStorage.getItem(AUTH_FLOW_KEY) === ADMIN_LOGIN_FLOW;
  const [error, setError] = useState('');

  function handleVerify() {
    const session = resolveUserFromPhone(pendingPhone, businesses);
    if (!session) return;

    if (isAdminFlow) {
      if (session.role !== 'admin') {
        setError('This number is not registered as an admin. Use /admin/log-in with an admin mobile.');
        return;
      }
      login(session);
      sessionStorage.removeItem(PENDING_PHONE_KEY);
      sessionStorage.removeItem(AUTH_FLOW_KEY);
      navigate('/admin');
      return;
    }

    login(session);
    sessionStorage.removeItem(PENDING_PHONE_KEY);
    sessionStorage.removeItem(AUTH_FLOW_KEY);

    const redirect = searchParams.get('redirect');
    if (redirect && session.role !== 'customer') {
      navigate(redirect);
      return;
    }
    navigate(getPostLoginPath(session));
  }

  const displayPhone = pendingPhone || 'your number';

  return (
    <div className="app-shell auth-page animate-in">
      <main className="auth-container">
        <h1>{isAdminFlow ? 'Verify admin access' : 'Verify your number'}</h1>
        <p className="auth-subtitle">Code sent to +91 {displayPhone.replace(/\D/g, '').slice(-10)}</p>

        {error && <p className="auth-error">{error}</p>}

        <div className="otp-row">
          {['4', '8', '2', '', '', ''].map((digit, i) => (
            <input
              key={i}
              type="text"
              maxLength={1}
              className={`otp-input ${digit ? 'filled' : ''}`}
              defaultValue={digit}
              aria-label={`Digit ${i + 1}`}
            />
          ))}
        </div>

        <button type="button" className="btn btn-primary btn-full" onClick={handleVerify}>
          Verify and continue
        </button>

        <p className="auth-footer">
          Didn&apos;t get a code? <button type="button" className="link-btn">Resend in 00:28</button>
        </p>
      </main>
    </div>
  );
}

export { PENDING_PHONE_KEY };

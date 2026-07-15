import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Logo } from '../../components/ui/Logo';
import { useAuth } from '../../context/AuthContext';
import {
  IS_SIGNUP,
  PENDING_NAME,
  PENDING_PHONE,
} from '../../lib/authKeys';
import './AuthPages.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { sendOtp, loginWithPassword, getPostLoginPath, authError, setAuthError } = useAuth();

  const [useOtp, setUseOtp] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    setBusy(true);
    setAuthError('');
    const result = await loginWithPassword(phone, password);
    setBusy(false);
    if (result.error) return;

    navigate(searchParams.get('redirect') || getPostLoginPath(result.user));
  }

  async function handleSendOtp() {
    setBusy(true);
    setAuthError('');
    const result = await sendOtp(phone);
    setBusy(false);
    if (result.error) return;

    sessionStorage.setItem(PENDING_PHONE, phone.trim());
    sessionStorage.removeItem(IS_SIGNUP);

    const redirect = searchParams.get('redirect');
    navigate(redirect ? `/otp?redirect=${encodeURIComponent(redirect)}` : '/otp');
  }

  return (
    <div className="app-shell auth-page animate-in">
      <main className="auth-container">
        <Logo />
        <h1>Welcome back</h1>
        <p className="auth-subtitle">
          {useOtp ? 'Log in with SMS OTP' : 'Log in with mobile and password'}
        </p>

        <label className="form-label" htmlFor="phone">Mobile number</label>
        <div className="phone-input-row">
          <span className="country-code">+91</span>
          <input
            id="phone"
            type="tel"
            className="form-input"
            placeholder="9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        {!useOtp && (
          <>
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input auth-password-input"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </>
        )}

        {authError && <p className="auth-error">{authError}</p>}

        {useOtp ? (
          <>
            <button type="button" className="btn btn-primary btn-full" onClick={handleSendOtp} disabled={busy}>
              {busy ? 'Sending OTP…' : 'Send OTP'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-full auth-switch-mode"
              onClick={() => {
                setAuthError('');
                setUseOtp(false);
              }}
            >
              ← Back to password login
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-primary btn-full" onClick={handleLogin} disabled={busy}>
              {busy ? 'Signing in…' : 'Log in'}
            </button>
            <div className="auth-divider">or</div>
            <button
              type="button"
              className="btn btn-secondary btn-full"
              onClick={() => {
                setAuthError('');
                setUseOtp(true);
              }}
            >
              Login with OTP
            </button>
          </>
        )}

        <p className="auth-footer">
          New customer? <Link to="/signup">Create an account</Link>
        </p>
      </main>
    </div>
  );
}

export function SignupPage() {
  const navigate = useNavigate();
  const { sendOtp, authError, setAuthError } = useAuth();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSendOtp() {
    setBusy(true);
    setAuthError('');
    const result = await sendOtp(phone);
    setBusy(false);
    if (result.error) return;

    sessionStorage.setItem(PENDING_PHONE, phone.trim());
    sessionStorage.setItem(IS_SIGNUP, '1');
    if (name.trim()) sessionStorage.setItem(PENDING_NAME, name.trim());
    navigate('/otp');
  }

  return (
    <div className="app-shell auth-page animate-in">
      <main className="auth-container">
        <Logo />
        <h1>Create account</h1>
        <p className="auth-subtitle">Verify with OTP, then set a password</p>

        <label className="form-label" htmlFor="name">Full name</label>
        <input
          id="name"
          type="text"
          className="form-input"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

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

        {authError && <p className="auth-error">{authError}</p>}

        <button type="button" className="btn btn-primary btn-full" onClick={handleSendOtp} disabled={busy}>
          {busy ? 'Sending OTP…' : 'Send OTP'}
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
  const { verifyOtp, sendOtp, getPostLoginPath, authError, setAuthError } = useAuth();

  const phone = sessionStorage.getItem(PENDING_PHONE) || '';
  const isSignup = sessionStorage.getItem(IS_SIGNUP) === '1';

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const inputsRef = useRef([]);

  function updateDigit(index, value) {
    const char = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    if (char && index < 5) inputsRef.current[index + 1]?.focus();
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  async function handleVerify() {
    setLocalError('');
    setAuthError('');
    const token = digits.join('');
    if (token.length < 6) {
      setLocalError('Enter the 6-digit OTP');
      return;
    }

    setBusy(true);
    const result = await verifyOtp(phone, token);
    setBusy(false);
    if (result.error) {
      setLocalError(result.error);
      return;
    }

    const user = result.user;
    sessionStorage.removeItem(PENDING_PHONE);
    sessionStorage.removeItem(PENDING_NAME);

    if (isSignup) {
      const next = searchParams.get('redirect') || getPostLoginPath(user);
      navigate(`/set-password?next=${encodeURIComponent(next)}`);
      return;
    }

    sessionStorage.removeItem(IS_SIGNUP);
    navigate(searchParams.get('redirect') || getPostLoginPath(user));
  }

  const error = localError || authError;

  return (
    <div className="app-shell auth-page animate-in">
      <main className="auth-container">
        <h1>Verify your number</h1>
        <p className="auth-subtitle">
          Enter the SMS code sent to +91 {phone.replace(/\D/g, '').slice(-10) || '…'}
        </p>

        {error && <p className="auth-error">{error}</p>}

        <div className="otp-row">
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => {
                inputsRef.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              className={`otp-input ${digit ? 'filled' : ''}`}
              value={digit}
              onChange={(e) => updateDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
            />
          ))}
        </div>

        <button type="button" className="btn btn-primary btn-full" onClick={handleVerify} disabled={busy}>
          {busy ? 'Verifying…' : 'Verify and continue'}
        </button>

        <p className="auth-footer">
          Didn&apos;t get a code?{' '}
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setLocalError('');
              setAuthError('');
              sendOtp(phone);
            }}
          >
            Resend OTP
          </button>
        </p>
      </main>
    </div>
  );
}

export function SetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { savePassword, isAuthenticated, loading, getPostLoginPath, user, authError, setAuthError } =
    useAuth();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const isSignup = sessionStorage.getItem(IS_SIGNUP) === '1';

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate('/login', { replace: true });
  }, [loading, isAuthenticated, navigate]);

  function goNext() {
    sessionStorage.removeItem(IS_SIGNUP);
    navigate(searchParams.get('next') || getPostLoginPath(user), { replace: true });
  }

  async function handleSave() {
    setLocalError('');
    setAuthError('');
    if (password !== confirm) {
      setLocalError('Passwords do not match');
      return;
    }

    setBusy(true);
    const result = await savePassword(password);
    setBusy(false);
    if (result.error) {
      setLocalError(result.error);
      return;
    }
    goNext();
  }

  const error = localError || authError;

  return (
    <div className="app-shell auth-page animate-in">
      <main className="auth-container">
        <Logo />
        <h1>Set your password</h1>
        <p className="auth-subtitle">You can use this password to log in next time</p>

        <label className="form-label" htmlFor="new-password">Password</label>
        <input
          id="new-password"
          type="password"
          className="form-input auth-password-input"
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <label className="form-label" htmlFor="confirm-password">Confirm password</label>
        <input
          id="confirm-password"
          type="password"
          className="form-input auth-password-input"
          placeholder="Re-enter password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        {error && <p className="auth-error">{error}</p>}

        <button type="button" className="btn btn-primary btn-full" onClick={handleSave} disabled={busy}>
          {busy ? 'Saving…' : 'Save password'}
        </button>

        {!isSignup && (
          <button type="button" className="btn btn-ghost btn-full auth-switch-mode" onClick={goNext}>
            Skip for now
          </button>
        )}
      </main>
    </div>
  );
}

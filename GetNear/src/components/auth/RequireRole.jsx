import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function RequireRole({ role, children }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    const loginPath = role === 'admin' ? '/admin/log-in' : '/login';
    return (
      <Navigate
        to={`${loginPath}?redirect=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  if (user.role !== role) {
    return (
      <div className="page-container" style={{ paddingTop: 48 }}>
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Access denied</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16 }}>
            Your account does not have permission to view this page.
          </p>
          <a href="/" className="btn btn-primary">Go home</a>
        </div>
      </div>
    );
  }

  return children;
}

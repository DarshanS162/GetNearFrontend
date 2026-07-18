import { Link, useNavigate } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar';
import { IconBack, IconChevron, IconLocation } from '../../components/ui/Icons';
import { useAuth } from '../../context/AuthContext';
import { formatAddressLine } from '../../domain/address';
import { useAddresses } from '../../presentation/hooks/useAddresses';
import './ProfilePage.css';

export default function ProfilePage() {
  const { user, isAuthenticated, logout, loading, isAdmin, isRestaurantOwner } = useAuth();
  const { defaultAddress } = useAddresses();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="app-shell">
        <Navbar showLocation={false} />
        <main className="page-container profile-page">
          <p style={{ color: 'var(--color-text-secondary)' }}>Loading…</p>
        </main>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="app-shell animate-in">
        <Navbar showLocation={false} />
        <main className="page-container profile-page">
          <div className="page-header">
            <Link to="/" className="back-btn" aria-label="Go back">
              <IconBack />
            </Link>
            <h1>Profile</h1>
          </div>
          <div className="empty-state card">
            <p>Sign in to manage orders and addresses.</p>
            <Link to="/login?redirect=/profile" className="btn btn-primary" style={{ marginTop: 12 }}>
              Login
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const menuItems = [
    ...(isRestaurantOwner
      ? [{ label: 'Owner dashboard', to: '/owner', icon: '🏪' }]
      : []),
    ...(isAdmin
      ? [{ label: 'Admin panel', to: '/admin', icon: '🛠️' }]
      : []),
    {
      label: 'Set / change password',
      to: `/set-password?next=${encodeURIComponent(isRestaurantOwner ? '/owner' : isAdmin ? '/admin' : '/profile')}`,
      icon: '🔐',
    },
    { label: 'Saved addresses', to: '/addresses', icon: '📍' },
    { label: 'Previous orders', to: '/orders', icon: '📦' },
  ];

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="app-shell animate-in">
      <Navbar showLocation={false} />
      <main className="page-container profile-page">
        <div className="page-header">
          <Link to="/" className="back-btn" aria-label="Go back">
            <IconBack />
          </Link>
          <h1>Profile</h1>
        </div>

        <div className="profile-header card">
          <div className="profile-avatar">{(user.fullName || 'U')[0]}</div>
          <div>
            <h2 className="profile-name">{user.fullName}</h2>
            <p>{user.phone ? `+91 ${user.phone}` : ''}</p>
            <p className="profile-email">{user.role}</p>
          </div>
        </div>

        {isRestaurantOwner && (
          <Link to="/owner" className="btn btn-primary btn-full" style={{ marginBottom: 16 }}>
            Open owner dashboard
          </Link>
        )}

        {defaultAddress && (
          <div className="profile-address card">
            <IconLocation size={18} />
            <div>
              <strong style={{ textTransform: 'capitalize' }}>{defaultAddress.label}</strong>
              <p>{formatAddressLine(defaultAddress)}</p>
            </div>
          </div>
        )}

        <nav className="profile-menu">
          {menuItems.map((item) => (
            <Link key={item.label} to={item.to} className="profile-menu-item card">
              <span>{item.icon}</span>
              <span>{item.label}</span>
              <IconChevron />
            </Link>
          ))}
        </nav>

        <button type="button" className="btn btn-secondary btn-full logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </main>
    </div>
  );
}

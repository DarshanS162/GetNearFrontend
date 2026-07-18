import { NavLink, Outlet } from 'react-router-dom';
import { Logo } from '../../components/ui/Logo';
import { RequireRole } from '../../components/auth/RequireRole';
import { useAuth } from '../../context/AuthContext';
import '../admin/AdminLayout.css';

const navItems = [
  { to: '/owner', label: 'Dashboard', end: true },
  { to: '/owner/orders', label: 'Orders' },
  { to: '/owner/menu', label: 'My menu' },
  { to: '/owner/settings', label: 'Store settings' },
];

export default function OwnerLayout() {
  const { user, logout } = useAuth();

  return (
    <RequireRole role="restaurant_owner">
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-header">
            <Logo size="sm" />
            <span className="admin-badge admin-badge--owner">Restaurant</span>
          </div>

          <nav className="admin-nav">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `admin-nav-link ${isActive ? 'admin-nav-link--active' : ''}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="admin-sidebar-footer">
            <p className="admin-user-label">{user?.fullName}</p>
            <button type="button" className="admin-back-link" onClick={logout}>
              Logout
            </button>
            <NavLink
              to="/?view=customer"
              className="admin-back-link"
              style={{ display: 'block', marginTop: 8 }}
            >
              ← Customer app
            </NavLink>
          </div>
        </aside>

        <div className="admin-main">
          <Outlet />
        </div>
      </div>
    </RequireRole>
  );
}

import { NavLink, Outlet } from 'react-router-dom';
import { Logo } from '../../components/ui/Logo';
import { RequireRole } from '../../components/auth/RequireRole';
import { useAuth } from '../../context/AuthContext';
import './AdminLayout.css';

const navItems = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/applications', label: 'Applications' },
  { to: '/admin/restaurants', label: 'Restaurants' },
  { to: '/admin/products', label: 'All menu items' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <RequireRole role="admin">
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-header">
            <Logo size="sm" />
            <span className="admin-badge">Admin</span>
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

import { NavLink, Outlet } from 'react-router-dom';
import { Logo } from '../../components/ui/Logo';
import { RequireRole } from '../../components/auth/RequireRole';
import { useAuth } from '../../context/AuthContext';
import {
  IconHome,
  IconOrders,
  IconMenuBoard,
  IconTicket,
  IconSettings,
} from '../../components/ui/Icons';
import '../admin/AdminLayout.css';
import './OwnerLayout.css';

const navItems = [
  { to: '/owner', label: 'Dashboard', short: 'Home', end: true, Icon: IconHome },
  { to: '/owner/orders', label: 'Orders', short: 'Orders', Icon: IconOrders },
  { to: '/owner/menu', label: 'My menu', short: 'Menu', Icon: IconMenuBoard },
  { to: '/owner/coupons', label: 'My coupons', short: 'Coupons', Icon: IconTicket },
  { to: '/owner/settings', label: 'Store settings', short: 'Store', Icon: IconSettings },
];

export default function OwnerLayout() {
  const { user, logout } = useAuth();

  return (
    <RequireRole role="restaurant_owner">
      <div className="admin-shell owner-shell">
        <header className="owner-mobile-top">
          <div className="owner-mobile-top-brand">
            <Logo size="sm" />
            <span className="owner-mobile-greeting">
              Hi, {user?.fullName?.split(' ')[0] || 'Partner'}
            </span>
          </div>
          <button type="button" className="owner-mobile-logout" onClick={logout}>
            Logout
          </button>
        </header>

        <aside className="admin-sidebar owner-sidebar">
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
                <item.Icon size={18} />
                <span>{item.label}</span>
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

        <div className="admin-main owner-main">
          <Outlet />
        </div>

        <nav className="owner-bottom-nav" aria-label="Owner navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `owner-bottom-nav-link ${isActive ? 'owner-bottom-nav-link--active' : ''}`
              }
            >
              <span className="owner-bottom-nav-icon">
                <item.Icon size={20} />
              </span>
              <span className="owner-bottom-nav-label">{item.short}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </RequireRole>
  );
}

import { Link } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { userProfile } from '../data/mockData';
import { IconChevron, IconLocation } from '../components/ui/Icons';
import './ProfilePage.css';

const menuItems = [
  { label: 'Saved addresses', to: '#', icon: '📍' },
  { label: 'Favorites', to: '#', icon: '❤️' },
  { label: 'Previous orders', to: '/order/GN2481', icon: '📦' },
  { label: 'Settings', to: '#', icon: '⚙️' },
];

export default function ProfilePage() {
  return (
    <div className="app-shell animate-in">
      <Navbar showLocation={false} />
      <main className="page-container profile-page">
        <div className="profile-header card">
          <div className="profile-avatar">{userProfile.name[0]}</div>
          <div>
            <h1>{userProfile.name}</h1>
            <p>{userProfile.phone}</p>
            <p className="profile-email">{userProfile.email}</p>
          </div>
        </div>

        <div className="profile-address card">
          <IconLocation size={18} />
          <div>
            <strong>{userProfile.address.label}</strong>
            <p>{userProfile.address.line}</p>
          </div>
        </div>

        <nav className="profile-menu">
          {menuItems.map((item) => (
            <Link key={item.label} to={item.to} className="profile-menu-item card">
              <span>{item.icon}</span>
              <span>{item.label}</span>
              <IconChevron />
            </Link>
          ))}
        </nav>

        <Link to="/login" className="btn btn-secondary btn-full logout-btn">
          Logout
        </Link>
      </main>
    </div>
  );
}

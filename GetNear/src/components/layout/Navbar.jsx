import { Link } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { IconLocation, IconUser } from '../ui/Icons';
import './Navbar.css';

export function Navbar({ showLocation = true }) {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" aria-label="GetNear home">
          <Logo size="sm" />
        </Link>
        {showLocation && (
          <div className="navbar-location">
            <IconLocation size={16} />
            <span>Andheri West, Mumbai</span>
          </div>
        )}
        <Link to="/profile" className="navbar-profile" aria-label="Profile">
          <IconUser size={20} />
        </Link>
      </div>
    </header>
  );
}

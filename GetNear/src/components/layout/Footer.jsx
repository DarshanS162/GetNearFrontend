import { Link } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import './Footer.css';

export function Footer() {
  return (
    <footer className="footer">
      <Logo size="sm" />
      <p className="footer-tagline">Great food, right nearby.</p>
      <div className="footer-links">
        <Link to="/">Home</Link>
        <Link to="/login">Login</Link>
      </div>
      <p className="footer-copy">© 2026 GetNear. All rights reserved.</p>
    </footer>
  );
}

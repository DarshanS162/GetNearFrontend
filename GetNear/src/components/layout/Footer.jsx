import { Link } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { IconPhone } from '../ui/Icons';
import './Footer.css';

const CONTACT_PHONE = '9552489313';
const CONTACT_TEL = `+91${CONTACT_PHONE}`;

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Logo size="sm" />
          <p className="footer-tagline">Great food, right nearby.</p>
        </div>

        <nav className="footer-links" aria-label="Footer">
          <Link to="/">Home</Link>
          <Link to="/orders">Orders</Link>
          <Link to="/login">Login</Link>
        </nav>

        <a href={`tel:${CONTACT_TEL}`} className="footer-contact">
          <span className="footer-contact-icon" aria-hidden="true">
            <IconPhone size={16} />
          </span>
          <span className="footer-contact-text">
            <span className="footer-contact-label">Contact</span>
            <span className="footer-contact-number">+91 {CONTACT_PHONE}</span>
          </span>
        </a>

        <Link to="/partner" className="footer-partner">
          <span className="footer-partner-copy">
            <span className="footer-partner-label">Restaurant owners</span>
            <span className="footer-partner-title">Partner with GetNear</span>
            <span className="footer-partner-hint">
              Apply now — your store stays inactive until we verify it.
            </span>
          </span>
          <span className="footer-partner-arrow" aria-hidden="true">
            →
          </span>
        </Link>

        <p className="footer-copy">© 2026 GetNear. All rights reserved.</p>
      </div>
    </footer>
  );
}

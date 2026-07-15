import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { IconLocation, IconUser } from '../ui/Icons';
import { getCurrentLocationLabel } from '../../lib/location';
import './Navbar.css';

export function Navbar({ showLocation = true }) {
  const [locationLabel, setLocationLabel] = useState('Detecting...');

  useEffect(() => {
    if (!showLocation) return undefined;

    let cancelled = false;

    getCurrentLocationLabel()
      .then(({ label }) => {
        if (!cancelled) setLocationLabel(label);
      })
      .catch(() => {
        if (!cancelled) setLocationLabel('Set location');
      });

    return () => {
      cancelled = true;
    };
  }, [showLocation]);

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" aria-label="GetNear home" className="navbar-brand">
          <Logo size="sm" />
        </Link>
        <div className="navbar-right">
          {showLocation && (
            <div className="navbar-location">
              <IconLocation size={16} />
              <span>{locationLabel}</span>
            </div>
          )}
          <Link to="/profile" className="navbar-profile" aria-label="Profile">
            <IconUser size={16} />
          </Link>
        </div>
      </div>
    </header>
  );
}

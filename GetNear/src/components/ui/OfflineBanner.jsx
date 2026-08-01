import { useEffect, useState } from 'react';
import './OfflineBanner.css';

export default function OfflineBanner() {
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );

  useEffect(() => {
    function sync() {
      setOffline(!navigator.onLine);
    }

    window.addEventListener('offline', sync);
    window.addEventListener('online', sync);
    sync();

    return () => {
      window.removeEventListener('offline', sync);
      window.removeEventListener('online', sync);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('is-offline', offline);
    return () => document.body.classList.remove('is-offline');
  }, [offline]);

  if (!offline) return null;

  return (
    <div className="offline-banner" role="status" aria-live="assertive">
      <div className="offline-banner-inner">
        <span className="offline-banner-icon" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div className="offline-banner-copy">
          <strong>You&apos;re offline</strong>
          <span>No internet connection. Check your network and try again.</span>
        </div>
      </div>
    </div>
  );
}

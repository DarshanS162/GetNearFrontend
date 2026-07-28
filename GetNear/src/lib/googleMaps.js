/**
 * Lazy-load Google Maps JavaScript API (Places not required).
 */

let mapsPromise = null;

export function getGoogleMapsApiKey() {
  return String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
}

export function isGoogleMapsConfigured() {
  return Boolean(getGoogleMapsApiKey());
}

/**
 * @returns {Promise<typeof google.maps>}
 */
export function loadGoogleMaps() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps is only available in the browser'));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (mapsPromise) return mapsPromise;

  const key = getGoogleMapsApiKey();
  if (!key) {
    return Promise.reject(
      new Error('Google Maps is not configured. Add VITE_GOOGLE_MAPS_API_KEY to your environment.')
    );
  }

  mapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-getnear-maps]');
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.google?.maps) resolve(window.google.maps);
        else reject(new Error('Google Maps failed to load'));
      });
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load')));
      return;
    }

    const script = document.createElement('script');
    script.dataset.getnearMaps = '1';
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`;
    script.onload = () => {
      if (window.google?.maps) resolve(window.google.maps);
      else reject(new Error('Google Maps failed to load'));
    };
    script.onerror = () => {
      mapsPromise = null;
      reject(new Error('Google Maps failed to load'));
    };
    document.head.appendChild(script);
  });

  return mapsPromise;
}

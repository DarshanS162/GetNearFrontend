const CACHE_KEY = 'getnear_current_location';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get the device's current coordinates via the Geolocation API.
 * @returns {Promise<{ lat: number, lng: number }>}
 */
export function getCurrentCoordinates(options = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => reject(err),
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 5 * 60 * 1000,
        ...options,
      }
    );
  });
}

/**
 * Reverse-geocode coordinates to an OpenStreetMap address object.
 */
export async function reverseGeocode(lat, lng) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'json');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('zoom', '16');
  url.searchParams.set('addressdetails', '1');

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
    },
  });

  if (!res.ok) {
    throw new Error('Failed to reverse geocode location');
  }

  return res.json();
}

/**
 * Build a short display label from a Nominatim address payload.
 * e.g. "Andheri West, Mumbai"
 */
export function formatLocationLabel(address) {
  if (!address) return '';

  const area =
    address.suburb ||
    address.neighbourhood ||
    address.city_district ||
    address.village ||
    address.hamlet ||
    address.municipality ||
    address.county;

  const city =
    address.city ||
    address.town ||
    address.state_district ||
    address.state;

  if (area && city && area !== city) return `${area}, ${city}`;
  return area || city || address.state || '';
}

function readCachedLocation() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached?.label || !cached?.cachedAt) return null;
    if (Date.now() - cached.cachedAt > CACHE_TTL_MS) return null;
    return cached;
  } catch {
    return null;
  }
}

function writeCachedLocation({ label, lat, lng }) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ label, lat, lng, cachedAt: Date.now() })
    );
  } catch {
    // ignore quota / private mode errors
  }
}

/**
 * High-level helper: current coords → reverse geocode → short label.
 * Uses a short-lived localStorage cache for maintainability / fewer API calls.
 *
 * @returns {Promise<{ label: string, lat: number, lng: number }>}
 */
export async function getCurrentLocationLabel({ useCache = true } = {}) {
  if (useCache) {
    const cached = readCachedLocation();
    if (cached) {
      return { label: cached.label, lat: cached.lat, lng: cached.lng };
    }
  }

  const { lat, lng } = await getCurrentCoordinates();
  const data = await reverseGeocode(lat, lng);
  const label = formatLocationLabel(data.address) || 'Current location';
  const result = { label, lat, lng };
  writeCachedLocation(result);
  return result;
}

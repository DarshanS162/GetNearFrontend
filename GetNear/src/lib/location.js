/**
 * Browser geolocation helpers with user-friendly error mapping.
 */

import { reverseGeocodeAddress } from './geocoding';

const CACHE_KEY = 'getnear_current_location';
const CACHE_TTL_MS = 30 * 60 * 1000;

export const LocationErrorCode = {
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  POSITION_UNAVAILABLE: 'POSITION_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  UNSUPPORTED: 'UNSUPPORTED',
  NETWORK: 'NETWORK',
  GEOCODE: 'GEOCODE',
  UNKNOWN: 'UNKNOWN',
};

export function mapGeolocationError(err) {
  const code = err?.code;
  if (code === 1 || /denied/i.test(err?.message || '')) {
    return {
      code: LocationErrorCode.PERMISSION_DENIED,
      message: 'Location permission denied. Enable location access in your browser settings.',
    };
  }
  if (code === 2) {
    return {
      code: LocationErrorCode.POSITION_UNAVAILABLE,
      message: 'Unable to determine your location. Try again outdoors or pick on the map.',
    };
  }
  if (code === 3) {
    return {
      code: LocationErrorCode.TIMEOUT,
      message: 'Location request timed out. Please try again.',
    };
  }
  if (/geolocat|not supported/i.test(err?.message || '')) {
    return {
      code: LocationErrorCode.UNSUPPORTED,
      message: 'Geolocation is not supported on this device.',
    };
  }
  return {
    code: LocationErrorCode.UNKNOWN,
    message: err?.message || 'Could not get your location',
  };
}

/**
 * High-accuracy GPS fix.
 * @returns {Promise<{ lat: number, lng: number, accuracy?: number }>}
 */
export function getCurrentCoordinates(options = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(Object.assign(new Error('Geolocation is not supported'), { code: 0 }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => reject(err),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
        ...options,
      }
    );
  });
}

/** @deprecated Use reverseGeocodeAddress from lib/geocoding.js */
export async function reverseGeocode(lat, lng) {
  const result = await reverseGeocodeAddress(lat, lng);
  return {
    display_name: result.formattedAddress,
    address: {
      city: result.city,
      state: result.state,
      postcode: result.pincode,
      country: result.country,
      suburb: result.line2,
      road: result.line1,
    },
  };
}

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
    // ignore
  }
}

/**
 * Current coords → reverse geocode → short navbar label.
 */
export async function getCurrentLocationLabel({ useCache = true } = {}) {
  if (useCache) {
    const cached = readCachedLocation();
    if (cached) {
      return { label: cached.label, lat: cached.lat, lng: cached.lng };
    }
  }

  const { lat, lng } = await getCurrentCoordinates({
    enableHighAccuracy: false,
    timeout: 10000,
    maximumAge: 5 * 60 * 1000,
  });
  const data = await reverseGeocodeAddress(lat, lng);
  const label =
    [data.line2, data.city].filter(Boolean).join(', ') ||
    data.formattedAddress?.split(',').slice(0, 2).join(',') ||
    'Current location';
  const result = { label, lat, lng };
  writeCachedLocation(result);
  return result;
}

/**
 * Full “use current location” flow for address forms.
 */
export async function detectCurrentAddress() {
  try {
    const { lat, lng } = await getCurrentCoordinates();
    const address = await reverseGeocodeAddress(lat, lng);
    return address;
  } catch (err) {
    const mapped = mapGeolocationError(err);
    if (
      mapped.code === LocationErrorCode.UNKNOWN &&
      /geocod|fetch|network|failed/i.test(err?.message || '')
    ) {
      throw Object.assign(new Error('Could not look up this address. Please try again.'), {
        code: LocationErrorCode.GEOCODE,
      });
    }
    throw Object.assign(new Error(mapped.message), { code: mapped.code });
  }
}

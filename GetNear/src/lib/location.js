/**
 * Browser geolocation helpers with user-friendly error mapping.
 */

import { reverseGeocodeAddress } from './geocoding';

const CACHE_KEY = 'getnear_current_location';
const CACHE_TTL_MS = 30 * 60 * 1000;

/** Warn / soft-reject when GPS accuracy is worse than this (meters). */
const POOR_ACCURACY_M = 150;
const UNUSABLE_ACCURACY_M = 2000;

export const LocationErrorCode = {
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  POSITION_UNAVAILABLE: 'POSITION_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  UNSUPPORTED: 'UNSUPPORTED',
  NETWORK: 'NETWORK',
  GEOCODE: 'GEOCODE',
  POOR_ACCURACY: 'POOR_ACCURACY',
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

function readPositionOnce(options) {
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
      options
    );
  });
}

/**
 * High-accuracy GPS fix. For address capture, takes up to two samples
 * and keeps the more accurate one (helps indoors / Wi‑Fi drift).
 * @returns {Promise<{ lat: number, lng: number, accuracy?: number }>}
 */
export async function getCurrentCoordinates(options = {}) {
  const {
    samples = 1,
    ...geoOptions
  } = options;

  const base = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0,
    ...geoOptions,
  };

  const first = await readPositionOnce(base);
  if (samples < 2) return first;

  try {
    const second = await readPositionOnce({
      ...base,
      timeout: Math.min(base.timeout || 15000, 10000),
    });
    if (
      second.accuracy != null &&
      (first.accuracy == null || second.accuracy < first.accuracy)
    ) {
      return second;
    }
  } catch {
    // keep first reading
  }

  return first;
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
    samples: 1,
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
 * Uses a dual GPS sample and keeps the pin on GPS coords (not geocoder centroid).
 */
export async function detectCurrentAddress() {
  try {
    const { lat, lng, accuracy } = await getCurrentCoordinates({
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
      samples: 2,
    });

    if (accuracy != null && accuracy > UNUSABLE_ACCURACY_M) {
      throw Object.assign(
        new Error(
          'GPS accuracy is too low right now. Move near a window or pick the pin on the map.'
        ),
        { code: LocationErrorCode.POOR_ACCURACY }
      );
    }

    const address = await reverseGeocodeAddress(lat, lng, { useCache: false });
    const enriched = {
      ...address,
      latitude: lat,
      longitude: lng,
      accuracyM: accuracy != null ? Math.round(accuracy) : null,
    };

    if (accuracy != null && accuracy > POOR_ACCURACY_M) {
      enriched.accuracyWarning =
        `GPS accuracy is about ${Math.round(accuracy)} m. Confirm the pin on the map if this looks off.`;
    }

    return enriched;
  } catch (err) {
    if (err?.code === LocationErrorCode.POOR_ACCURACY) throw err;

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

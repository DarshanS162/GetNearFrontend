/**
 * Reverse geocoding with retry, caching, and provider fallback.
 * Prefers Google Geocoding when VITE_GOOGLE_MAPS_API_KEY is set;
 * falls back to OpenStreetMap Nominatim.
 */

const CACHE_PREFIX = 'getnear_geocode_';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 400;

function cacheKey(lat, lng) {
  // ~11m precision — enough to reuse nearby reverse results
  return `${CACHE_PREFIX}${Number(lat).toFixed(4)}_${Number(lng).toFixed(4)}`;
}

function readCache(lat, lng) {
  try {
    const raw = localStorage.getItem(cacheKey(lat, lng));
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached?.cachedAt || Date.now() - cached.cachedAt > CACHE_TTL_MS) return null;
    return cached.result || null;
  } catch {
    return null;
  }
}

function writeCache(lat, lng, result) {
  try {
    localStorage.setItem(
      cacheKey(lat, lng),
      JSON.stringify({ result, cachedAt: Date.now() })
    );
  } catch {
    // ignore quota / private mode
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}

async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        if (isRetryableStatus(res.status) && attempt < retries) {
          await sleep(RETRY_BASE_MS * 2 ** attempt);
          continue;
        }
        throw new Error(`Geocoding failed (${res.status})`);
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(RETRY_BASE_MS * 2 ** attempt);
        continue;
      }
    }
  }
  throw lastError || new Error('Geocoding failed');
}

function googleMapsKey() {
  return String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
}

/**
 * Normalize provider payloads into a stable address shape for forms.
 */
export function normalizeGeocodeResult({
  formattedAddress = '',
  line1 = '',
  line2 = '',
  city = '',
  state = '',
  pincode = '',
  country = 'India',
  lat,
  lng,
  provider = 'unknown',
} = {}) {
  return {
    formattedAddress: String(formattedAddress || '').trim(),
    line1: String(line1 || '').trim(),
    line2: String(line2 || '').trim(),
    city: String(city || '').trim(),
    state: String(state || '').trim(),
    pincode: String(pincode || '').replace(/\D/g, '').slice(0, 6),
    country: String(country || 'India').trim() || 'India',
    latitude: Number(lat),
    longitude: Number(lng),
    provider,
  };
}

function componentMap(components = []) {
  const map = {};
  for (const c of components) {
    for (const type of c.types || []) {
      if (!map[type]) map[type] = c.long_name;
      if (type === 'postal_code') map.postal_code = c.short_name || c.long_name;
    }
  }
  return map;
}

async function reverseGeocodeGoogle(lat, lng) {
  const key = googleMapsKey();
  if (!key) return null;

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('latlng', `${lat},${lng}`);
  url.searchParams.set('key', key);
  url.searchParams.set('language', 'en');
  url.searchParams.set('result_type', 'street_address|premise|route|sublocality|locality');

  const res = await fetchWithRetry(url.toString());
  const data = await res.json();

  if (data.status === 'ZERO_RESULTS') {
    throw new Error('No address found for this location');
  }
  if (data.status !== 'OK' || !data.results?.[0]) {
    throw new Error(data.error_message || `Google geocoding: ${data.status}`);
  }

  const best = data.results[0];
  const c = componentMap(best.address_components || []);
  const premise = [c.premise, c.subpremise].filter(Boolean).join(', ');
  const street = [c.street_number, c.route].filter(Boolean).join(' ');

  return normalizeGeocodeResult({
    formattedAddress: best.formatted_address,
    line1: premise || street || c.sublocality_level_1 || '',
    line2: c.neighborhood || c.sublocality || c.sublocality_level_2 || '',
    city: c.locality || c.administrative_area_level_2 || c.sublocality_level_1 || '',
    state: c.administrative_area_level_1 || '',
    pincode: c.postal_code || '',
    country: c.country || 'India',
    lat,
    lng,
    provider: 'google',
  });
}

async function reverseGeocodeNominatim(lat, lng) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'json');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('zoom', '18');
  url.searchParams.set('addressdetails', '1');

  const res = await fetchWithRetry(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
    },
  });

  const data = await res.json();
  if (!data || data.error) {
    throw new Error(data?.error || 'Failed to reverse geocode location');
  }

  const a = data.address || {};
  const house = [a.house_number, a.building].filter(Boolean).join(', ');
  const road = a.road || a.pedestrian || a.path || '';

  return normalizeGeocodeResult({
    formattedAddress: data.display_name || '',
    line1: house || road || a.neighbourhood || '',
    line2: a.suburb || a.neighbourhood || a.city_district || '',
    city: a.city || a.town || a.village || a.municipality || a.state_district || '',
    state: a.state || '',
    pincode: a.postcode || '',
    country: a.country || 'India',
    lat,
    lng,
    provider: 'nominatim',
  });
}

/**
 * Reverse-geocode coordinates into form-ready address fields.
 * @returns {Promise<ReturnType<typeof normalizeGeocodeResult>>}
 */
export async function reverseGeocodeAddress(lat, lng, { useCache = true } = {}) {
  const latitude = Number(lat);
  const longitude = Number(lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Invalid coordinates');
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error('Invalid coordinates');
  }

  if (useCache) {
    const cached = readCache(latitude, longitude);
    if (cached) return cached;
  }

  let result;
  try {
    result = await reverseGeocodeGoogle(latitude, longitude);
  } catch {
    result = null;
  }

  if (!result) {
    result = await reverseGeocodeNominatim(latitude, longitude);
  }

  writeCache(latitude, longitude, result);
  return result;
}

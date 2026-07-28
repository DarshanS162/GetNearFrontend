/**
 * Reverse geocoding with retry, caching, and provider fallback.
 * Prefers Google Geocoding when VITE_GOOGLE_MAPS_API_KEY is set;
 * falls back to OpenStreetMap Nominatim.
 *
 * Important: stored latitude/longitude always come from the GPS/map pin.
 * Geocoding only fills readable address text — never relocates the pin.
 */

const CACHE_PREFIX = 'getnear_geocode_v2_';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 400;

/** Prefer results whose geometry is within this distance of the pin. */
const MAX_RESULT_DISTANCE_M = 750;

const LOCATION_TYPE_SCORE = {
  ROOFTOP: 40,
  RANGE_INTERPOLATED: 30,
  GEOMETRIC_CENTER: 10,
  APPROXIMATE: 0,
};

const TYPE_SCORE = {
  street_address: 50,
  premise: 48,
  subpremise: 46,
  route: 35,
  intersection: 32,
  neighborhood: 20,
  sublocality_level_2: 18,
  sublocality_level_1: 15,
  sublocality: 15,
  locality: 5,
  political: 2,
};

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

/** Haversine distance in meters. */
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Normalize provider payloads into a stable address shape for forms.
 * latitude/longitude must be the pin coords, not the geocoder geometry.
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
  accuracyM = null,
  resultDistanceM = null,
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
    accuracyM: accuracyM != null ? Number(accuracyM) : null,
    resultDistanceM: resultDistanceM != null ? Number(resultDistanceM) : null,
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

function resultTypeBonus(types = []) {
  let best = 0;
  for (const t of types) {
    if (TYPE_SCORE[t] != null) best = Math.max(best, TYPE_SCORE[t]);
  }
  return best;
}

/**
 * Pick the Google result closest to the pin that is also street-level when possible.
 * Avoids locality centroids that can be several km away from the GPS point.
 */
function pickBestGoogleResult(results, lat, lng) {
  if (!results?.length) return null;

  const scored = results.map((result) => {
    const geometry = result.geometry || {};
    const loc = geometry.location || {};
    const resultLat = Number(loc.lat);
    const resultLng = Number(loc.lng);
    const dist =
      Number.isFinite(resultLat) && Number.isFinite(resultLng)
        ? distanceMeters(lat, lng, resultLat, resultLng)
        : Number.POSITIVE_INFINITY;

    const locationType = geometry.location_type || 'APPROXIMATE';
    const score =
      resultTypeBonus(result.types || []) +
      (LOCATION_TYPE_SCORE[locationType] || 0) -
      Math.min(dist, 5000) / 50;

    return { result, dist, score, locationType };
  });

  scored.sort((a, b) => b.score - a.score);

  const nearby = scored.filter((s) => s.dist <= MAX_RESULT_DISTANCE_M);
  const pool = nearby.length ? nearby : scored;
  return pool[0];
}

function mapGoogleResult(best, lat, lng, resultDistanceM) {
  const c = componentMap(best.address_components || []);
  const premise = [c.premise, c.subpremise].filter(Boolean).join(', ');
  const street = [c.street_number, c.route].filter(Boolean).join(' ');

  return normalizeGeocodeResult({
    formattedAddress: best.formatted_address,
    line1: premise || street || c.neighborhood || c.sublocality_level_1 || '',
    line2: c.neighborhood || c.sublocality || c.sublocality_level_2 || '',
    city: c.locality || c.administrative_area_level_2 || c.sublocality_level_1 || '',
    state: c.administrative_area_level_1 || '',
    pincode: c.postal_code || '',
    country: c.country || 'India',
    lat,
    lng,
    provider: 'google',
    resultDistanceM,
  });
}

async function reverseGeocodeGoogle(lat, lng) {
  const key = googleMapsKey();
  if (!key) return null;

  // Do NOT filter to locality — that often returns an area centroid km away.
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('latlng', `${lat},${lng}`);
  url.searchParams.set('key', key);
  url.searchParams.set('language', 'en');

  const res = await fetchWithRetry(url.toString());
  const data = await res.json();

  if (data.status === 'ZERO_RESULTS') {
    throw new Error('No address found for this location');
  }
  if (data.status !== 'OK' || !data.results?.length) {
    throw new Error(data.error_message || `Google geocoding: ${data.status}`);
  }

  const picked = pickBestGoogleResult(data.results, lat, lng);
  if (!picked) {
    throw new Error('No address found for this location');
  }

  return mapGoogleResult(picked.result, lat, lng, Math.round(picked.dist));
}

async function reverseGeocodeNominatim(lat, lng) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  // Building / house-level when available
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
  const resultLat = Number(data.lat);
  const resultLng = Number(data.lon);
  const resultDistanceM =
    Number.isFinite(resultLat) && Number.isFinite(resultLng)
      ? Math.round(distanceMeters(lat, lng, resultLat, resultLng))
      : null;

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
    resultDistanceM,
  });
}

/**
 * Reverse-geocode coordinates into form-ready address fields.
 * Coordinates on the returned object are always the input pin.
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
    if (cached) {
      return {
        ...cached,
        // Always bind to the requested pin (never a geocoder centroid)
        latitude,
        longitude,
      };
    }
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

/** Address domain helpers (NestJS-portable). */

export const ADDRESS_LABELS = ['home', 'work', 'other'];

/**
 * Parse lat/lng from RPC JSON, GeoJSON Point, or legacy columns.
 */
export function extractCoordinates(row) {
  if (!row) return { latitude: null, longitude: null };

  if (row.latitude != null && row.longitude != null) {
    return {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    };
  }

  const loc = row.location;
  if (!loc) return { latitude: null, longitude: null };

  if (typeof loc === 'object' && Array.isArray(loc.coordinates)) {
    const [lng, lat] = loc.coordinates;
    return { latitude: Number(lat), longitude: Number(lng) };
  }

  if (typeof loc === 'string') {
    try {
      const parsed = JSON.parse(loc);
      if (Array.isArray(parsed?.coordinates)) {
        const [lng, lat] = parsed.coordinates;
        return { latitude: Number(lat), longitude: Number(lng) };
      }
    } catch {
      // EWKT: SRID=4326;POINT(lng lat)
      const match = loc.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
      if (match) {
        return {
          latitude: Number(match[2]),
          longitude: Number(match[1]),
        };
      }
    }
  }

  return { latitude: null, longitude: null };
}

export function mapAddress(row) {
  if (!row) return null;
  const { latitude, longitude } = extractCoordinates(row);

  return {
    id: row.id,
    userId: row.user_id,
    label: row.label || 'home',
    fullName: row.full_name,
    phone: row.phone,
    line1: row.address_line1,
    line2: row.address_line2 || '',
    landmark: row.landmark || '',
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    country: row.country || 'India',
    formattedAddress: row.formatted_address || '',
    latitude,
    longitude,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
  };
}

export function formatAddressLine(address) {
  if (!address) return '';
  if (address.formattedAddress) {
    const parts = [address.line1, address.landmark, address.formattedAddress]
      .filter(Boolean);
    // Prefer structured line when house number differs from formatted blob
    if (address.line1 && address.city) {
      return [
        address.line1,
        address.line2,
        address.landmark,
        address.city,
        address.state,
        address.pincode,
      ]
        .filter(Boolean)
        .join(', ');
    }
    return parts.join(', ');
  }
  return [
    address.line1,
    address.line2,
    address.landmark,
    address.city,
    address.state,
    address.pincode,
  ]
    .filter(Boolean)
    .join(', ');
}

/**
 * Payload for create/update RPCs (lat/lng → PostGIS on the server).
 * Do not send separate latitude/longitude DB columns — location is source of truth.
 */
export function toAddressRpcParams(input) {
  return {
    p_label: input.label || 'home',
    p_full_name: String(input.fullName || '').trim(),
    p_phone: String(input.phone || '').trim(),
    p_address_line1: String(input.line1 || '').trim(),
    p_address_line2: String(input.line2 || '').trim() || null,
    p_city: String(input.city || '').trim(),
    p_state: String(input.state || '').trim(),
    p_pincode: String(input.pincode || '').trim(),
    p_country: input.country || 'India',
    p_landmark: String(input.landmark || '').trim() || null,
    p_formatted_address: String(input.formattedAddress || '').trim() || null,
    p_latitude: input.latitude != null ? Number(input.latitude) : null,
    p_longitude: input.longitude != null ? Number(input.longitude) : null,
    p_is_default: Boolean(input.isDefault),
  };
}

/** @deprecated Prefer toAddressRpcParams — kept for NestJS portability docs. */
export function toAddressRow(input, userId) {
  return {
    user_id: userId,
    label: input.label || 'home',
    full_name: String(input.fullName || '').trim(),
    phone: String(input.phone || '').trim(),
    address_line1: String(input.line1 || '').trim(),
    address_line2: String(input.line2 || '').trim() || null,
    city: String(input.city || '').trim(),
    state: String(input.state || '').trim(),
    pincode: String(input.pincode || '').trim(),
    country: input.country || 'India',
    landmark: String(input.landmark || '').trim() || null,
    formatted_address: String(input.formattedAddress || '').trim() || null,
    is_default: Boolean(input.isDefault),
  };
}

export function validateAddressInput(input) {
  const errors = [];
  if (!String(input.fullName || '').trim()) errors.push('Name is required');
  if (String(input.phone || '').replace(/\D/g, '').length < 10) {
    errors.push('Valid phone is required');
  }
  if (!String(input.line1 || '').trim()) errors.push('House / flat number is required');
  if (!String(input.city || '').trim()) errors.push('City is required');
  if (!String(input.state || '').trim()) errors.push('State is required');
  if (!/^[0-9]{6}$/.test(String(input.pincode || '').trim())) {
    errors.push('Pincode must be 6 digits');
  }
  if (input.label && !ADDRESS_LABELS.includes(input.label)) {
    errors.push('Invalid address label');
  }

  const lat = Number(input.latitude);
  const lng = Number(input.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    errors.push('Map location is required — use current location or pick on map');
  } else if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    errors.push('Invalid coordinates');
  }

  return errors;
}

export function buildDeliverySnapshot(address) {
  if (!address) return null;
  return {
    full_name: address.fullName,
    phone: address.phone,
    label: address.label,
    address_line1: address.line1,
    address_line2: address.line2 || null,
    landmark: address.landmark || null,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    country: address.country || 'India',
    formatted_address: address.formattedAddress || null,
    latitude: address.latitude,
    longitude: address.longitude,
  };
}

/** Address domain helpers (NestJS-portable). */

export const ADDRESS_LABELS = ['home', 'work', 'other'];

export function mapAddress(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label || 'home',
    fullName: row.full_name,
    phone: row.phone,
    line1: row.address_line1,
    line2: row.address_line2 || '',
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    country: row.country || 'India',
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
  };
}

export function formatAddressLine(address) {
  if (!address) return '';
  return [address.line1, address.line2, address.city, address.state, address.pincode]
    .filter(Boolean)
    .join(', ');
}

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
    is_default: Boolean(input.isDefault),
  };
}

export function validateAddressInput(input) {
  const errors = [];
  if (!String(input.fullName || '').trim()) errors.push('Name is required');
  if (String(input.phone || '').replace(/\D/g, '').length < 10) {
    errors.push('Valid phone is required');
  }
  if (!String(input.line1 || '').trim()) errors.push('Address line is required');
  if (!String(input.city || '').trim()) errors.push('City is required');
  if (!String(input.state || '').trim()) errors.push('State is required');
  if (!/^[0-9]{6}$/.test(String(input.pincode || '').trim())) {
    errors.push('Pincode must be 6 digits');
  }
  if (input.label && !ADDRESS_LABELS.includes(input.label)) {
    errors.push('Invalid address label');
  }
  return errors;
}

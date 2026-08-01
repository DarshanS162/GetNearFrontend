/** Normalize to last 10 digits (India mobile). */
export function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

/** E.164 for India (+91XXXXXXXXXX) — required by Supabase Phone Auth. */
export function toE164India(phone) {
  const digits = normalizePhone(phone);
  if (digits.length !== 10) return null;
  return `+91${digits}`;
}

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * UUID-like id that works outside secure contexts (e.g. phone on http://LAN-IP).
 * Prefer crypto.randomUUID when available.
 */
export function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function mapRestaurant(row, owner = null) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.cuisine_type || '',
    location: row.location_label || '',
    description: row.description || '',
    contactPhone: row.contact_phone || '',
    contactEmail: row.contact_email || '',
    gstNumber: row.gst_number || '',
    fssaiNumber: row.fssai_number || '',
    ownerId: row.owner_id || null,
    ownerPhone: owner?.phone || '',
    ownerName: owner?.full_name || '',
    businessStatus: row.business_status || 'active',
    rejectionReason: row.rejection_reason || '',
    rating: 4.0,
    reviews: 0,
    deliveryTime: Number(row.delivery_time_minutes) || 30,
    freeDeliveryAbove: Number(row.free_delivery_above) || 299,
    isActive: row.is_active !== false,
    isOpen: row.business_status === 'active' && row.is_active !== false,
    bannerColor: row.banner_color || '#FFF0E8',
    icon: row.icon_emoji || '🍽️',
    bannerUrl: row.banner_url || '',
    logoUrl: row.logo_url || '',
    category: row.category_slug || 'food',
    offer: row.offer_badge || '',
  };
}

export function mapCategory(row) {
  if (!row) return null;
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    slug: row.slug,
  };
}

export function mapProduct(row) {
  if (!row) return null;
  const pricingType =
    row.pricing_type === 'full_half' ? 'full_half' : 'piece';
  const fullPrice =
    row.full_price != null ? Number(row.full_price) : Number(row.selling_price);
  const halfPrice = row.half_price != null ? Number(row.half_price) : 0;
  const price =
    pricingType === 'full_half' ? fullPrice : Number(row.selling_price);

  return {
    id: row.id,
    businessId: row.restaurant_id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description || '',
    price,
    mrp: Number(row.mrp),
    pricingType,
    fullPrice: pricingType === 'full_half' ? fullPrice : null,
    halfPrice: pricingType === 'full_half' ? halfPrice : null,
    foodType: row.food_type || 'veg',
    prepTime: Number(row.preparation_time_minutes) || 15,
    ingredients: row.ingredients || '',
    isAvailable: row.is_available !== false,
    imageUrl: row.primary_image_url || '',
  };
}

export function getPostLoginPath(user) {
  if (user?.role === 'admin' || user?.role === 'super_admin') return '/admin';
  if (user?.role === 'restaurant_owner') return '/owner';
  return '/';
}

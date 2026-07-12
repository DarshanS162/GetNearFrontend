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
    rating: 4.0,
    reviews: 0,
    deliveryTime: Number(row.delivery_time_minutes) || 30,
    freeDeliveryAbove: Number(row.free_delivery_above) || 299,
    isOpen: row.business_status === 'active' && row.is_active !== false,
    bannerColor: row.banner_color || '#FFF0E8',
    icon: row.icon_emoji || '🍽️',
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
  return {
    id: row.id,
    businessId: row.restaurant_id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description || '',
    price: Number(row.selling_price),
    mrp: Number(row.mrp),
    foodType: row.food_type || 'veg',
    prepTime: Number(row.preparation_time_minutes) || 15,
    ingredients: row.ingredients || '',
    isAvailable: row.is_available !== false,
  };
}

export function getPostLoginPath(user) {
  if (user?.role === 'admin' || user?.role === 'super_admin') return '/admin';
  if (user?.role === 'restaurant_owner') return '/owner/menu';
  return '/';
}

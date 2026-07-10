export const categories = [
  { id: 'food', name: 'Food', icon: '🍕', color: '#FF6B35', bg: 'rgba(255,107,53,0.12)' },
  { id: 'grocery', name: 'Grocery', icon: '🛒', color: '#2EC4B6', bg: 'rgba(46,196,182,0.12)' },
  { id: 'pharmacy', name: 'Pharmacy', icon: '💊', color: '#FF9F1C', bg: 'rgba(255,159,28,0.12)' },
  { id: 'bakery', name: 'Bakery', icon: '🥐', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
];

/** No default restaurants — add via admin panel. */
export const businesses = [];

/** No default menu categories — created when adding products in admin. */
export const menuCategories = [];

/** No default products — add via admin panel. */
export const products = [];

export const reviews = [];

export const userProfile = {
  name: 'Aarav Sharma',
  phone: '+91 98765 43210',
  email: 'aarav@email.com',
  address: {
    label: 'Home',
    line: '402, Silver Oak, Andheri West, Mumbai',
  },
};

/** Seeded platform admins (see migration 024_seed_admin_users.sql). */
export const adminUsers = [
  { fullName: 'Farine Khan', phone: '8668879497' },
  { fullName: 'Darshan Salunkhe', phone: '9552489313' },
];

export const deliveryFee = 22;
export const taxRate = 0.05;

export function getBusiness(id) {
  return businesses.find((b) => b.id === id);
}

export function getProduct(id) {
  return products.find((p) => p.id === id);
}

export function getBusinessProducts(businessId, categoryId) {
  return products.filter(
    (p) =>
      p.businessId === businessId &&
      (!categoryId || p.categoryId === categoryId),
  );
}

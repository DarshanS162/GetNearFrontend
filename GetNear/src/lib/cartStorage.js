const CART_STORAGE_KEY = 'getnear_cart_v2';
const LEGACY_CART_KEY = 'getnear_cart_v1';

/**
 * Persist cart lines in localStorage.
 * Shape: { businessId, items: [{ productId, quantity, option }] }
 * option: 'full' | 'half' | 'piece'
 */
export function readStoredCart() {
  try {
    let raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_CART_KEY);
    }
    if (!raw) return { businessId: '', items: [] };
    const parsed = JSON.parse(raw);
    const businessId = typeof parsed?.businessId === 'string' ? parsed.businessId : '';
    const items = Array.isArray(parsed?.items)
      ? parsed.items
          .map((row) => {
            const option = ['full', 'half', 'piece'].includes(row?.option)
              ? row.option
              : 'piece';
            return {
              productId: String(row?.productId || ''),
              quantity: Math.max(1, Math.floor(Number(row?.quantity) || 0)),
              option,
            };
          })
          .filter((row) => row.productId && row.quantity > 0)
      : [];
    return { businessId: items.length ? businessId : '', items };
  } catch {
    return { businessId: '', items: [] };
  }
}

export function writeStoredCart({ businessId, items }) {
  try {
    if (!items?.length) {
      localStorage.removeItem(CART_STORAGE_KEY);
      localStorage.removeItem(LEGACY_CART_KEY);
      return;
    }
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({
        businessId: businessId || '',
        items: items.map((row) => ({
          productId: row.productId,
          quantity: row.quantity,
          option: row.option || 'piece',
        })),
      }),
    );
    localStorage.removeItem(LEGACY_CART_KEY);
  } catch {
    // Quota / private mode — ignore
  }
}

export function clearStoredCart() {
  try {
    localStorage.removeItem(CART_STORAGE_KEY);
    localStorage.removeItem(LEGACY_CART_KEY);
  } catch {
    // ignore
  }
}

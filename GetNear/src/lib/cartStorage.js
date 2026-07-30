const CART_STORAGE_KEY = 'getnear_cart_v1';

/**
 * Persist cart lines in localStorage so refresh doesn't wipe the cart.
 * Shape: { businessId: string, items: Array<{ productId: string, quantity: number }> }
 */
export function readStoredCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return { businessId: '', items: [] };
    const parsed = JSON.parse(raw);
    const businessId = typeof parsed?.businessId === 'string' ? parsed.businessId : '';
    const items = Array.isArray(parsed?.items)
      ? parsed.items
          .map((row) => ({
            productId: String(row?.productId || ''),
            quantity: Math.max(1, Math.floor(Number(row?.quantity) || 0)),
          }))
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
      return;
    }
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({
        businessId: businessId || '',
        items: items.map((row) => ({
          productId: row.productId,
          quantity: row.quantity,
        })),
      }),
    );
  } catch {
    // Quota / private mode — ignore
  }
}

export function clearStoredCart() {
  try {
    localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    // ignore
  }
}

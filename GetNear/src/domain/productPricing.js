/** Item pricing: Full/Half OR Piece — never both. Half is optional. */

export const PRICING_TYPE = {
  FULL_HALF: 'full_half',
  PIECE: 'piece',
};

export const PRICING_OPTION = {
  FULL: 'full',
  HALF: 'half',
  PIECE: 'piece',
};

export function normalizePricingType(value) {
  return value === PRICING_TYPE.FULL_HALF
    ? PRICING_TYPE.FULL_HALF
    : PRICING_TYPE.PIECE;
}

export function isFullHalf(product) {
  return normalizePricingType(product?.pricingType) === PRICING_TYPE.FULL_HALF;
}

export function hasHalfOption(product) {
  if (!isFullHalf(product)) return false;
  const half = Number(product.halfPrice);
  return Number.isFinite(half) && half >= 0 && product.halfPrice != null;
}

export function defaultOption(product) {
  return isFullHalf(product) ? PRICING_OPTION.FULL : PRICING_OPTION.PIECE;
}

export function normalizeOption(product, option) {
  if (isFullHalf(product)) {
    if (option === PRICING_OPTION.HALF && hasHalfOption(product)) {
      return PRICING_OPTION.HALF;
    }
    return PRICING_OPTION.FULL;
  }
  return PRICING_OPTION.PIECE;
}

export function optionLabel(option) {
  if (option === PRICING_OPTION.FULL) return 'Full';
  if (option === PRICING_OPTION.HALF) return 'Half';
  return '1 Pc';
}

export function resolveUnitPrice(product, option) {
  const opt = normalizeOption(product, option);
  if (isFullHalf(product)) {
    if (opt === PRICING_OPTION.HALF) {
      return Number(product.halfPrice) || 0;
    }
    return Number(product.fullPrice ?? product.price) || 0;
  }
  return Number(product.price) || 0;
}

export function formatLineName(productName, option) {
  return `${productName} (${optionLabel(option)})`;
}

/** Compact price text for lists. */
export function formatPriceSummary(product) {
  if (isFullHalf(product)) {
    const full = Number(product.fullPrice ?? product.price) || 0;
    if (hasHalfOption(product)) {
      return `Full ₹${full} · Half ₹${product.halfPrice}`;
    }
    return `Full ₹${full}`;
  }
  return `₹${Number(product.price) || 0}`;
}

export function cartLineKey(productId, option) {
  return `${productId}::${option || PRICING_OPTION.PIECE}`;
}

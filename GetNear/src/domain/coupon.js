export const COUPON_OWNER = {
  PLATFORM: 'platform',
  BUSINESS: 'business',
};

export const COUPON_SCOPE = {
  PLATFORM: 'platform',
  BUSINESS: 'business',
  ORDER: 'order',
  CATEGORY: 'category',
  PRODUCT: 'product',
};

export const DISCOUNT_TYPE = {
  FLAT: 'flat',
  PERCENTAGE: 'percentage',
  FREE_DELIVERY: 'free_delivery',
  BUY_X_GET_Y: 'buy_x_get_y',
};

export const COUPON_AUDIENCE = {
  ALL: 'all',
  NEW_USERS: 'new_users',
  EXISTING_USERS: 'existing_users',
};

export function mapCoupon(row, usage = []) {
  if (!row) return null;
  const redemptions = usage.filter((item) => item.coupon_id === row.id);
  return {
    id: row.id,
    restaurantId: row.restaurant_id || '',
    code: row.code,
    title: row.title || '',
    description: row.description || '',
    ownerType: row.owner_type || (row.restaurant_id ? 'business' : 'platform'),
    scope: row.scope || 'order',
    discountType: row.discount_type,
    discountValue: Number(row.discount_value) || 0,
    minOrderAmount: Number(row.min_order_amount) || 0,
    maxDiscountAmount:
      row.max_discount_amount == null ? null : Number(row.max_discount_amount),
    usageLimit: row.usage_limit == null ? null : Number(row.usage_limit),
    usageCount: Number(row.usage_count) || redemptions.length,
    perUserLimit: Number(row.per_user_limit) || 1,
    validFrom: row.valid_from,
    validUntil: row.valid_until || '',
    audience: row.audience || 'all',
    firstOrderOnly: Boolean(row.first_order_only),
    isRewardOnly: Boolean(row.is_reward_only),
    buyQuantity: row.buy_quantity == null ? null : Number(row.buy_quantity),
    getQuantity: row.get_quantity == null ? null : Number(row.get_quantity),
    rules: row.rules || {},
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    totalDiscount: redemptions.reduce(
      (sum, item) => sum + Number(item.discount_applied || 0),
      0,
    ),
    targets: {
      businesses: (row.coupon_businesses || []).map((item) => item.restaurant_id),
      categories: (row.coupon_categories || []).map((item) => item.category_id),
      products: (row.coupon_products || []).map((item) => item.product_id),
    },
  };
}

export function couponDiscountLabel(coupon) {
  if (coupon.discountType === DISCOUNT_TYPE.FREE_DELIVERY) return 'Free delivery';
  if (coupon.discountType === DISCOUNT_TYPE.PERCENTAGE) {
    return `${coupon.discountValue}% off`;
  }
  if (coupon.discountType === DISCOUNT_TYPE.BUY_X_GET_Y) {
    return `Buy ${coupon.buyQuantity} get ${coupon.getQuantity}`;
  }
  return `₹${coupon.discountValue} off`;
}

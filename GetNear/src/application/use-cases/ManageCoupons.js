const VALID_SCOPES = new Set(['platform', 'business', 'order', 'category', 'product']);
const VALID_DISCOUNTS = new Set([
  'flat',
  'percentage',
  'free_delivery',
  'buy_x_get_y',
]);

export class ManageCoupons {
  constructor({ couponRepository }) {
    this.couponRepository = couponRepository;
  }

  list(filters) {
    return this.couponRepository.list(filters);
  }

  listRedemptions() {
    return this.couponRepository.listRedemptions();
  }

  async save(input) {
    const code = String(input.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
      throw new Error('Code must be 3–30 letters, numbers, _ or -');
    }
    if (!VALID_SCOPES.has(input.scope)) throw new Error('Invalid coupon scope');
    if (!VALID_DISCOUNTS.has(input.discountType)) {
      throw new Error('Invalid discount type');
    }
    if (input.ownerType === 'business' && !input.restaurantId) {
      throw new Error('Business coupon requires a restaurant');
    }
    if (input.ownerType === 'business' && input.scope === 'platform') {
      throw new Error('Business coupons cannot use platform scope');
    }
    if (
      input.discountType === 'percentage' &&
      (Number(input.discountValue) <= 0 || Number(input.discountValue) > 100)
    ) {
      throw new Error('Percentage must be between 1 and 100');
    }
    if (input.discountType === 'flat' && Number(input.discountValue) <= 0) {
      throw new Error('Flat discount must be greater than zero');
    }
    if (input.scope === 'product' && !input.targets?.products?.length) {
      throw new Error('Select at least one product');
    }
    if (input.scope === 'category' && !input.targets?.categories?.length) {
      throw new Error('Select at least one category');
    }

    return this.couponRepository.save({ ...input, code });
  }

  setActive(id, isActive) {
    return this.couponRepository.setActive(id, isActive);
  }

  remove(id) {
    return this.couponRepository.remove(id);
  }
}

export class ValidateCoupon {
  constructor({ couponRepository }) {
    this.couponRepository = couponRepository;
  }

  execute(command) {
    const code = String(command.code || '').trim().toUpperCase();
    if (!code) throw new Error('Enter a coupon code');
    if (!command.restaurantId) throw new Error('Restaurant is required');
    return this.couponRepository.validate({ ...command, code });
  }
}

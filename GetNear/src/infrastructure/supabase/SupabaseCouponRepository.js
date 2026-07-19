import { mapCoupon } from '../../domain/coupon';

const COUPON_SELECT = `
  *,
  coupon_businesses ( restaurant_id ),
  coupon_categories ( category_id ),
  coupon_products ( product_id )
`;

export class SupabaseCouponRepository {
  /** @param {import('@supabase/supabase-js').SupabaseClient} client */
  constructor(client) {
    this.client = client;
  }

  async validate({ code, restaurantId, items, subtotal, deliveryCharge }) {
    const { data, error } = await this.client.rpc('validate_coupon', {
      p_code: code,
      p_restaurant_id: restaurantId,
      p_items: items,
      p_subtotal: subtotal,
      p_delivery_charge: deliveryCharge,
    });
    if (error) throw error;
    if (!data?.valid) throw new Error(data?.message || 'Coupon is not valid');
    return data;
  }

  async list({ restaurantId = '', ownerType = '' } = {}) {
    let query = this.client
      .from('coupons')
      .select(COUPON_SELECT)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (restaurantId) query = query.eq('restaurant_id', restaurantId);
    if (ownerType) query = query.eq('owner_type', ownerType);

    const [{ data, error }, usageResult] = await Promise.all([
      query,
      this.client
        .from('coupon_usages')
        .select('coupon_id, discount_applied, created_at'),
    ]);
    if (error) throw error;

    const usage = usageResult.error ? [] : usageResult.data || [];
    return (data || []).map((row) => mapCoupon(row, usage));
  }

  async save(input) {
    const row = {
      restaurant_id: input.ownerType === 'business' ? input.restaurantId : null,
      code: input.code.trim().toUpperCase(),
      title: input.title.trim() || null,
      description: input.description.trim() || null,
      owner_type: input.ownerType,
      scope: input.scope,
      discount_type: input.discountType,
      discount_value:
        input.discountType === 'free_delivery' ? 0 : Number(input.discountValue),
      min_order_amount: Number(input.minOrderAmount) || 0,
      max_discount_amount:
        input.maxDiscountAmount === '' ? null : Number(input.maxDiscountAmount),
      usage_limit: input.usageLimit === '' ? null : Number(input.usageLimit),
      per_user_limit: Number(input.perUserLimit) || 1,
      valid_from: input.validFrom,
      valid_until: input.validUntil || null,
      audience: input.audience,
      first_order_only: Boolean(input.firstOrderOnly),
      is_reward_only: Boolean(input.isRewardOnly),
      buy_quantity: input.buyQuantity ? Number(input.buyQuantity) : null,
      get_quantity: input.getQuantity ? Number(input.getQuantity) : null,
      is_active: Boolean(input.isActive),
      rules: input.rules || {},
    };

    let result;
    if (input.id) {
      result = await this.client
        .from('coupons')
        .update(row)
        .eq('id', input.id)
        .select(COUPON_SELECT)
        .single();
    } else {
      result = await this.client
        .from('coupons')
        .insert(row)
        .select(COUPON_SELECT)
        .single();
    }
    if (result.error) throw result.error;

    await this.replaceTargets(result.data.id, input.targets || {});

    const { data, error } = await this.client
      .from('coupons')
      .select(COUPON_SELECT)
      .eq('id', result.data.id)
      .single();
    if (error) throw error;
    return mapCoupon(data);
  }

  async replaceTargets(couponId, targets) {
    const tables = [
      ['coupon_businesses', 'restaurant_id', targets.businesses],
      ['coupon_categories', 'category_id', targets.categories],
      ['coupon_products', 'product_id', targets.products],
    ];

    for (const [table, key, ids = []] of tables) {
      const { error: deleteError } = await this.client
        .from(table)
        .delete()
        .eq('coupon_id', couponId);
      if (deleteError) throw deleteError;

      const uniqueIds = [...new Set(ids.filter(Boolean))];
      if (uniqueIds.length) {
        const { error: insertError } = await this.client
          .from(table)
          .insert(uniqueIds.map((id) => ({ coupon_id: couponId, [key]: id })));
        if (insertError) throw insertError;
      }
    }
  }

  async setActive(id, isActive) {
    const { error } = await this.client
      .from('coupons')
      .update({ is_active: Boolean(isActive) })
      .eq('id', id);
    if (error) throw error;
  }

  async remove(id) {
    const { error } = await this.client
      .from('coupons')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id);
    if (error) throw error;
  }

  async listRedemptions() {
    const { data, error } = await this.client
      .from('coupon_usages')
      .select(`
        *,
        coupons ( code, title, restaurant_id ),
        users ( full_name, phone ),
        orders ( order_number, restaurant_id )
      `)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
}

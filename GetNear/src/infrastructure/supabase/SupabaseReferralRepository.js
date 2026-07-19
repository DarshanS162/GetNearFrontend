export class SupabaseReferralRepository {
  /** @param {import('@supabase/supabase-js').SupabaseClient} client */
  constructor(client) {
    this.client = client;
  }

  async claim(code) {
    const { data, error } = await this.client.rpc('claim_referral_code', {
      p_referral_code: String(code || '').trim().toUpperCase(),
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.message || 'Could not apply referral code');
    return data;
  }

  async getMyReferralProfile(userId) {
    const [{ data: profile, error: profileError }, { data: referrals, error: referralError }] =
      await Promise.all([
        this.client
          .from('users')
          .select('referral_code')
          .eq('id', userId)
          .single(),
        this.client
          .from('referrals')
          .select('id, status, registered_at, rewarded_at')
          .eq('referrer_user_id', userId)
          .order('registered_at', { ascending: false }),
      ]);
    if (profileError) throw profileError;
    if (referralError) throw referralError;
    return {
      referralCode: profile?.referral_code || '',
      referrals: referrals || [],
    };
  }

  async listCampaigns() {
    const { data, error } = await this.client
      .from('referral_campaigns')
      .select(`
        *,
        referrer_coupon:coupons!referral_campaigns_referrer_coupon_id_fkey(id, code),
        referred_coupon:coupons!referral_campaigns_referred_coupon_id_fkey(id, code)
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async saveCampaign(input) {
    const row = {
      name: input.name.trim(),
      referrer_coupon_id: input.referrerCouponId || null,
      referred_coupon_id: input.referredCouponId || null,
      reward_type: input.rewardType || 'coupon',
      reward_value: Number(input.rewardValue) || 0,
      valid_from: input.validFrom,
      valid_until: input.validUntil || null,
      is_active: Boolean(input.isActive),
      rules: input.rules || {},
    };

    const query = input.id
      ? this.client.from('referral_campaigns').update(row).eq('id', input.id)
      : this.client.from('referral_campaigns').insert(row);
    const { data, error } = await query.select('*').single();
    if (error) throw error;
    return data;
  }

  async setCampaignActive(id, isActive) {
    const { error } = await this.client
      .from('referral_campaigns')
      .update({ is_active: Boolean(isActive) })
      .eq('id', id);
    if (error) throw error;
  }

  async listReferrals() {
    const { data, error } = await this.client
      .from('referrals')
      .select(`
        *,
        referrer:users!referrals_referrer_user_id_fkey(full_name, phone, referral_code),
        referred:users!referrals_referred_user_id_fkey(full_name, phone),
        orders(order_number)
      `)
      .order('registered_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
}

/**
 * Branch infrastructure adapter.
 * @implements {import('../../application/ports/BranchRepositoryPort').BranchRepositoryPort}
 */
export class SupabaseBranchRepository {
  /** @param {import('@supabase/supabase-js').SupabaseClient} client */
  constructor(client) {
    this.client = client;
  }

  async ensureMainBranchId(restaurantId) {
    const { data, error } = await this.client.rpc('ensure_main_branch', {
      p_restaurant_id: restaurantId,
    });

    if (error) throw error;
    if (!data) throw new Error('Could not resolve restaurant branch');
    return data;
  }

  async getDeliveryRadiusKm(restaurantId) {
    const { data, error } = await this.client
      .from('restaurant_branches')
      .select('delivery_radius_km')
      .eq('restaurant_id', restaurantId)
      .eq('is_main_branch', true)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    if (!data) return 5;
    return Number(data.delivery_radius_km);
  }

  async setDeliveryRadiusKm(restaurantId, radiusKm) {
    const branchId = await this.ensureMainBranchId(restaurantId);

    const { error } = await this.client
      .from('restaurant_branches')
      .update({
        delivery_radius_km: radiusKm,
        updated_at: new Date().toISOString(),
      })
      .eq('id', branchId);

    if (error) throw error;
  }

  /**
   * @returns {Promise<boolean|null>} true/false if hours known; null if no schedule (use is_active).
   */
  async isBranchOpenNow(branchId, now = new Date()) {
    if (!branchId) return null;

    const day = now.getDay(); // 0=Sun
    const today = now.toISOString().slice(0, 10);
    const mins = now.getHours() * 60 + now.getMinutes();

    const { data: branch } = await this.client
      .from('restaurant_branches')
      .select('restaurant_id')
      .eq('id', branchId)
      .maybeSingle();

    if (branch?.restaurant_id) {
      const { data: holiday } = await this.client
        .from('holidays')
        .select('id')
        .eq('restaurant_id', branch.restaurant_id)
        .eq('holiday_date', today)
        .is('deleted_at', null)
        .or(`branch_id.is.null,branch_id.eq.${branchId}`)
        .maybeSingle();
      if (holiday) return false;
    }

    const { data: hours, error } = await this.client
      .from('operating_hours')
      .select('open_time, close_time, is_closed')
      .eq('branch_id', branchId)
      .eq('day_of_week', day)
      .maybeSingle();

    if (error || !hours) return null;
    if (hours.is_closed) return false;

    const toMins = (t) => {
      if (!t) return null;
      const [h, m] = String(t).split(':').map(Number);
      return h * 60 + m;
    };
    const open = toMins(hours.open_time);
    const close = toMins(hours.close_time);
    if (open == null || close == null) return null;
    return mins >= open && mins < close;
  }
}

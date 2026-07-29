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
}

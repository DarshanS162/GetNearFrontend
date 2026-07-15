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
}

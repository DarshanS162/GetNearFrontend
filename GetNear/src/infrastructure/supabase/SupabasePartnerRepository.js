import { mapRestaurant } from '../../lib/utils';

export class SupabasePartnerRepository {
  /** @param {import('@supabase/supabase-js').SupabaseClient} client */
  constructor(client) {
    this.client = client;
  }

  async submitApplication(input) {
    const { data, error } = await this.client.rpc('submit_partner_application', {
      p_restaurant_name: input.restaurantName,
      p_owner_name: input.ownerName,
      p_phone: input.phone,
      p_location: input.location || null,
      p_cuisine: input.cuisine || null,
      p_description: input.description || null,
      p_gst_number: input.gstNumber || null,
      p_fssai_number: input.fssaiNumber || null,
      p_contact_email: input.contactEmail || null,
    });
    if (error) throw error;
    return mapRestaurant(data);
  }

  async listPending() {
    const { data, error } = await this.client
      .from('restaurants')
      .select('*')
      .eq('business_status', 'pending_approval')
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const rows = data || [];
    const ownerIds = [...new Set(rows.map((r) => r.owner_id).filter(Boolean))];
    let ownersById = {};
    if (ownerIds.length) {
      const { data: owners } = await this.client
        .from('users')
        .select('id, full_name, phone')
        .in('id', ownerIds);
      ownersById = Object.fromEntries((owners || []).map((o) => [o.id, o]));
    }

    return rows.map((row) => mapRestaurant(row, ownersById[row.owner_id]));
  }

  async approve(restaurantId) {
    const { data, error } = await this.client.rpc('approve_partner_application', {
      p_restaurant_id: restaurantId,
    });
    if (error) throw error;
    return mapRestaurant(data);
  }

  async reject(restaurantId, reason = '') {
    const { data, error } = await this.client.rpc('reject_partner_application', {
      p_restaurant_id: restaurantId,
      p_reason: reason || null,
    });
    if (error) throw error;
    return mapRestaurant(data);
  }

  async updateStoreSettings(restaurantId, patch) {
    const { data, error } = await this.client
      .from('restaurants')
      .update({
        name: patch.name,
        description: patch.description || null,
        cuisine_type: patch.type || null,
        location_label: patch.location || null,
        contact_phone: patch.contactPhone || null,
        contact_email: patch.contactEmail || null,
        gst_number: patch.gstNumber || null,
        fssai_number: patch.fssaiNumber || null,
        delivery_time_minutes: Number(patch.deliveryTime) || 30,
        free_delivery_above: Number(patch.freeDeliveryAbove) || 299,
        banner_color: patch.bannerColor || '#FFF0E8',
        icon_emoji: patch.icon || '🍽️',
        offer_badge: patch.offer || null,
        banner_url: patch.bannerUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', restaurantId)
      .is('deleted_at', null)
      .select('*')
      .single();

    if (error) throw error;
    return mapRestaurant(data);
  }

  async setStoreOpen(restaurantId, isOpen) {
    const { data, error } = await this.client
      .from('restaurants')
      .update({
        is_active: Boolean(isOpen),
        // keep business_status as active when toggling open/close
        updated_at: new Date().toISOString(),
      })
      .eq('id', restaurantId)
      .eq('business_status', 'active')
      .is('deleted_at', null)
      .select('*')
      .single();

    if (error) throw error;
    return mapRestaurant(data);
  }
}

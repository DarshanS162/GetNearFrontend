import { mapAddress, toAddressRpcParams } from '../../domain/address';
import { mapRlsError, resolveAppUserId } from './resolveAppUserId';

/**
 * Infrastructure adapter — swap for NestJS TypeORM/Prisma repository later.
 * Address geo is stored as PostGIS geography via SECURITY DEFINER RPCs.
 * @implements {import('../../application/ports/AddressRepositoryPort').AddressRepositoryPort}
 */
export class SupabaseAddressRepository {
  /** @param {import('@supabase/supabase-js').SupabaseClient} client */
  constructor(client) {
    this.client = client;
  }

  async resolveUserId(fallbackUserId, hints = {}) {
    const appUserId = await resolveAppUserId(this.client, hints);
    if (fallbackUserId && fallbackUserId !== appUserId) {
      console.warn(
        'Auth profile id mismatch; using RLS app user id for address write.',
        { fallbackUserId, appUserId },
      );
    }
    return appUserId;
  }

  async listByUserId(userId) {
    await this.resolveUserId(userId);
    const { data, error } = await this.client.rpc('list_customer_addresses');
    if (error) throw mapRlsError(error);
    const rows = Array.isArray(data) ? data : [];
    return rows.map(mapAddress);
  }

  async findById(id) {
    const { data, error } = await this.client.rpc('get_customer_address', {
      p_address_id: id,
    });
    if (error) throw mapRlsError(error);
    return mapAddress(data);
  }

  async create(userId, input) {
    try {
      await this.resolveUserId(userId, {
        fullName: input.fullName,
        phone: input.phone,
      });

      const { data, error } = await this.client.rpc(
        'create_customer_address',
        toAddressRpcParams(input),
      );
      if (error) throw error;
      return mapAddress(data);
    } catch (err) {
      throw mapRlsError(err);
    }
  }

  async update(userId, addressId, input) {
    try {
      await this.resolveUserId(userId, {
        fullName: input.fullName,
        phone: input.phone,
      });

      const { data, error } = await this.client.rpc('update_customer_address', {
        p_address_id: addressId,
        ...toAddressRpcParams(input),
      });
      if (error) throw error;
      return mapAddress(data);
    } catch (err) {
      throw mapRlsError(err);
    }
  }

  async softDelete(userId, addressId) {
    try {
      const writableId = await this.resolveUserId(userId);
      const { error } = await this.client
        .from('addresses')
        .update({ deleted_at: new Date().toISOString(), is_default: false })
        .eq('id', addressId)
        .eq('user_id', writableId)
        .is('deleted_at', null);

      if (error) throw error;
    } catch (err) {
      throw mapRlsError(err);
    }
  }

  async setDefault(userId, addressId) {
    try {
      const writableId = await this.resolveUserId(userId);
      await this.clearDefault(writableId);
      const { data, error } = await this.client
        .from('addresses')
        .update({ is_default: true })
        .eq('id', addressId)
        .eq('user_id', writableId)
        .is('deleted_at', null)
        .select('*')
        .single();

      if (error) throw error;

      // Enrich with coords via RPC (select * no longer has lat/lng columns)
      const enriched = await this.findById(addressId);
      return enriched || mapAddress(data);
    } catch (err) {
      throw mapRlsError(err);
    }
  }

  async clearDefault(userId) {
    const { error } = await this.client
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true)
      .is('deleted_at', null);

    if (error) throw mapRlsError(error);
  }

  /**
   * Verify ownership, delivery radius (ST_DWithin), and return snapshot payload.
   */
  async validateDelivery(addressId, branchId) {
    const { data, error } = await this.client.rpc('validate_delivery_radius', {
      p_address_id: addressId,
      p_branch_id: branchId,
    });
    if (error) throw mapRlsError(error);
    return data;
  }
}

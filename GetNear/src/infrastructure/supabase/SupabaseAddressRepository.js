import { mapAddress, toAddressRow } from '../../domain/address';
import { mapRlsError, resolveAppUserId } from './resolveAppUserId';

/**
 * Infrastructure adapter — swap for NestJS TypeORM/Prisma repository later.
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
    const writableId = await this.resolveUserId(userId);
    const { data, error } = await this.client
      .from('addresses')
      .select('*')
      .eq('user_id', writableId)
      .is('deleted_at', null)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw mapRlsError(error);
    return (data || []).map(mapAddress);
  }

  async findById(id) {
    const { data, error } = await this.client
      .from('addresses')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw mapRlsError(error);
    return mapAddress(data);
  }

  async create(userId, input) {
    try {
      const writableId = await this.resolveUserId(userId, {
        fullName: input.fullName,
        phone: input.phone,
      });

      if (input.isDefault) {
        await this.clearDefault(writableId);
      }

      const { data, error } = await this.client
        .from('addresses')
        .insert(toAddressRow(input, writableId))
        .select('*')
        .single();

      if (error) throw error;
      return mapAddress(data);
    } catch (err) {
      throw mapRlsError(err);
    }
  }

  async update(userId, addressId, input) {
    try {
      const writableId = await this.resolveUserId(userId, {
        fullName: input.fullName,
        phone: input.phone,
      });

      if (input.isDefault) {
        await this.clearDefault(writableId);
      }

      const row = toAddressRow(input, writableId);
      delete row.user_id;

      const { data, error } = await this.client
        .from('addresses')
        .update(row)
        .eq('id', addressId)
        .eq('user_id', writableId)
        .is('deleted_at', null)
        .select('*')
        .single();

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
      return mapAddress(data);
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
}

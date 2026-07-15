import { useCallback, useEffect, useState } from 'react';
import { addressUseCases } from '../../application/container';
import { useAuth } from '../../context/AuthContext';

export function useAddresses() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setAddresses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const rows = await addressUseCases.list.execute(user.id);
      setAddresses(rows);
    } catch (err) {
      setError(err.message || 'Failed to load addresses');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function createAddress(input) {
    if (!user?.id) {
      throw new Error('Login required. Please sign in again.');
    }
    const created = await addressUseCases.create.execute(user.id, input);
    await refresh();
    return created;
  }

  async function updateAddress(addressId, input) {
    const updated = await addressUseCases.update.execute(user.id, addressId, input);
    await refresh();
    return updated;
  }

  async function deleteAddress(addressId) {
    await addressUseCases.remove.execute(user.id, addressId);
    await refresh();
  }

  async function setDefaultAddress(addressId) {
    await addressUseCases.setDefault.execute(user.id, addressId);
    await refresh();
  }

  return {
    addresses,
    loading,
    error,
    refresh,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    defaultAddress: addresses.find((a) => a.isDefault) || addresses[0] || null,
  };
}

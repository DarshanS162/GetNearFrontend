import { useCallback, useRef, useState } from 'react';
import { reverseGeocodeAddress } from '../../lib/geocoding';
import { detectCurrentAddress, mapGeolocationError } from '../../lib/location';

/**
 * Reverse geocoding + current-location helpers for address UIs.
 */
export function useGeocodedLocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const lastRequest = useRef(0);

  const reverseGeocode = useCallback(async (lat, lng) => {
    setLoading(true);
    setError('');
    const requestId = ++lastRequest.current;
    try {
      const result = await reverseGeocodeAddress(lat, lng);
      if (requestId !== lastRequest.current) return null;
      return result;
    } catch (err) {
      if (requestId !== lastRequest.current) return null;
      const message = err.message || 'Could not look up this address';
      setError(message);
      throw Object.assign(new Error(message), { code: 'GEOCODE' });
    } finally {
      if (requestId === lastRequest.current) setLoading(false);
    }
  }, []);

  const useCurrentLocation = useCallback(async () => {
    setLoading(true);
    setError('');
    const requestId = ++lastRequest.current;
    try {
      const result = await detectCurrentAddress();
      if (requestId !== lastRequest.current) return null;
      return result;
    } catch (err) {
      if (requestId !== lastRequest.current) return null;
      const mapped = mapGeolocationError(err);
      setError(err.message || mapped.message);
      throw err;
    } finally {
      if (requestId === lastRequest.current) setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    reverseGeocode,
    useCurrentLocation,
    clearError: () => setError(''),
  };
}

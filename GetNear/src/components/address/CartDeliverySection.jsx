import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconLocation } from '../ui/Icons';
import { formatAddressLine } from '../../domain/address';
import { useAddresses } from '../../presentation/hooks/useAddresses';
import { useAuth } from '../../context/AuthContext';
import { AddressModal, EMPTY_ADDRESS_FORM } from './AddressModal';
import './address-components.css';

export const SELECTED_ADDRESS_KEY = 'getnear_selected_address_id';

export function readSelectedAddressId() {
  try {
    return sessionStorage.getItem(SELECTED_ADDRESS_KEY) || '';
  } catch {
    return '';
  }
}

export function writeSelectedAddressId(id) {
  try {
    if (id) sessionStorage.setItem(SELECTED_ADDRESS_KEY, id);
    else sessionStorage.removeItem(SELECTED_ADDRESS_KEY);
  } catch {
    // ignore
  }
}

/**
 * Compact delivery location picker for cart.
 * Select a saved address or add one with GPS / map without leaving the page.
 */
export function CartDeliverySection({
  selectedAddressId,
  onSelectAddressId,
  addOpen = false,
  onAddOpenChange,
}) {
  const { user } = useAuth();
  const {
    addresses,
    loading,
    error,
    createAddress,
    defaultAddress,
  } = useAddresses();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [internalAddOpen, setInternalAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const modalOpen = onAddOpenChange ? addOpen : internalAddOpen;

  function setModalOpen(next) {
    if (onAddOpenChange) onAddOpenChange(next);
    else setInternalAddOpen(next);
  }

  useEffect(() => {
    if (!selectedAddressId && defaultAddress?.id) {
      onSelectAddressId?.(defaultAddress.id);
    }
  }, [defaultAddress?.id, selectedAddressId, onSelectAddressId]);

  const selectedAddress =
    addresses.find((a) => a.id === selectedAddressId) || defaultAddress || null;

  const addForm = useMemo(
    () => ({
      ...EMPTY_ADDRESS_FORM,
      fullName: user?.fullName || '',
      phone: user?.phone || '',
      isDefault: addresses.length === 0,
    }),
    [user?.fullName, user?.phone, addresses.length],
  );

  async function handleSave(form) {
    setSaving(true);
    try {
      const created = await createAddress(form);
      onSelectAddressId?.(created.id);
      setModalOpen(false);
      setPickerOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <div className="cart-delivery card">
        <div className="cart-delivery-row">
          <div className="address-icon">
            <IconLocation size={20} />
          </div>
          <div className="address-info">
            <strong>Delivery location</strong>
            <p>Sign in to add or choose where we should deliver.</p>
          </div>
          <Link to="/login" className="btn btn-secondary btn-sm">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="cart-delivery card">
        <div className="cart-delivery-row">
          <div className="address-icon">
            <IconLocation size={20} />
          </div>
          <div className="address-info">
            {loading && <p>Loading addresses…</p>}
            {!loading && selectedAddress && (
              <>
                <strong style={{ textTransform: 'capitalize' }}>
                  Deliver to · {selectedAddress.label}
                </strong>
                <p>{formatAddressLine(selectedAddress)}</p>
                {selectedAddress.latitude == null && (
                  <p className="form-error" style={{ marginTop: 6, marginBottom: 0 }}>
                    Needs a map pin — add location again.
                  </p>
                )}
              </>
            )}
            {!loading && !selectedAddress && (
              <>
                <strong>Add delivery location</strong>
                <p>Use current location or pick on the map.</p>
              </>
            )}
            {error && <p className="form-error" style={{ marginTop: 6 }}>{error}</p>}
          </div>
          {addresses.length > 0 ? (
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setPickerOpen((v) => !v)}
            >
              Change
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setModalOpen(true)}
            >
              Add
            </button>
          )}
        </div>

        {pickerOpen && (
          <div className="cart-delivery-picker">
            {addresses.map((address) => (
              <button
                key={address.id}
                type="button"
                className={`address-picker-item ${
                  address.id === selectedAddress?.id ? 'active' : ''
                }`}
                onClick={() => {
                  onSelectAddressId?.(address.id);
                  setPickerOpen(false);
                }}
              >
                <strong style={{ textTransform: 'capitalize' }}>{address.label}</strong>
                <span>{formatAddressLine(address)}</span>
              </button>
            ))}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ marginTop: 8, width: '100%' }}
              onClick={() => {
                setPickerOpen(false);
                setModalOpen(true);
              }}
            >
              Add new location
            </button>
          </div>
        )}

        {!loading && addresses.length > 0 && !pickerOpen && (
          <button
            type="button"
            className="btn-ghost btn-sm cart-delivery-add-link"
            onClick={() => setModalOpen(true)}
          >
            + Add new location
          </button>
        )}
      </div>

      <AddressModal
        key="cart-add-address"
        open={modalOpen}
        mode="add"
        initialForm={addForm}
        saving={saving}
        onSave={handleSave}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

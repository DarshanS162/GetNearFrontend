import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AddressFormFields } from './AddressFormFields';
import { CurrentLocationButton } from './CurrentLocationButton';
import { MapPickerModal } from './MapPickerModal';
import { detectCurrentAddress } from '../../lib/location';

export const EMPTY_ADDRESS_FORM = {
  label: 'home',
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India',
  formattedAddress: '',
  latitude: null,
  longitude: null,
  isDefault: false,
};

function applyGeocodeToForm(prev, geo) {
  return {
    ...prev,
    line1: prev.line1?.trim() ? prev.line1 : geo.line1 || '',
    line2: geo.line2 || prev.line2 || '',
    city: geo.city || prev.city || '',
    state: geo.state || prev.state || '',
    pincode: geo.pincode || prev.pincode || '',
    country: geo.country || prev.country || 'India',
    formattedAddress: geo.formattedAddress || '',
    // Always keep the GPS / map pin — never the geocoder area centroid
    latitude: geo.latitude,
    longitude: geo.longitude,
    accuracyM: geo.accuracyM ?? null,
    accuracyWarning: geo.accuracyWarning || '',
  };
}

/**
 * Shared add / edit address modal with GPS + map picker entry points.
 */
export function AddressModal({
  open,
  mode = 'add',
  initialForm = EMPTY_ADDRESS_FORM,
  saving = false,
  onSave,
  onClose,
}) {
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState('');
  const [locating, setLocating] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initialForm);
    setFormError('');
    setMapOpen(false);
    // Only re-seed when the modal opens (parent remounts via key for edit/add).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  async function handleUseCurrentLocation() {
    setFormError('');
    setLocating(true);
    try {
      const geo = await detectCurrentAddress();
      setForm((prev) => applyGeocodeToForm(prev, geo));
      if (geo.accuracyWarning) {
        setFormError(geo.accuracyWarning);
      }
    } catch (err) {
      setFormError(err.message || 'Could not get current location');
    } finally {
      setLocating(false);
    }
  }

  function handleMapConfirm(geo) {
    setForm((prev) => applyGeocodeToForm(prev, geo));
    setMapOpen(false);
    setFormError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    try {
      await onSave?.(form);
    } catch (err) {
      setFormError(err.message || 'Could not save address');
    }
  }

  if (!open) return null;

  const hasPin = form.latitude != null && form.longitude != null;

  return createPortal(
    <>
      <div className="address-form-overlay" role="dialog" aria-modal="true">
        <form className="address-form card" onSubmit={handleSubmit}>
          <h2>{mode === 'edit' ? 'Edit address' : 'Add address'}</h2>
          {formError && <p className="form-error">{formError}</p>}

          <div className="address-entry-actions">
            <CurrentLocationButton
              onClick={handleUseCurrentLocation}
              loading={locating}
              disabled={saving}
            />
            <button
              type="button"
              className="btn btn-secondary btn-full"
              onClick={() => setMapOpen(true)}
              disabled={saving}
            >
              Search or pick on map
            </button>
          </div>

          {!hasPin && (
            <p className="muted">
              Use current location, or search / pick a pin on the map to continue.
            </p>
          )}

          {hasPin && form.formattedAddress && (
            <div className="address-detected">
              <strong>Selected location</strong>
              <p>{form.formattedAddress}</p>
            </div>
          )}
          {hasPin && (
            <AddressFormFields form={form} onChange={setForm} />
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !hasPin}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>

      <MapPickerModal
        open={mapOpen}
        initialLat={form.latitude}
        initialLng={form.longitude}
        onConfirm={handleMapConfirm}
        onClose={() => setMapOpen(false)}
      />
    </>,
    document.body,
  );
}

export function AddAddressModal(props) {
  return <AddressModal {...props} mode="add" />;
}

export function EditAddressModal(props) {
  return <AddressModal {...props} mode="edit" />;
}

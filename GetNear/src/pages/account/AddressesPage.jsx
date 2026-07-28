import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar';
import { RequireAuth } from '../../components/auth/RequireAuth';
import { IconBack } from '../../components/ui/Icons';
import {
  AddressList,
  AddressModal,
  EMPTY_ADDRESS_FORM,
} from '../../components/address';
import { useAddresses } from '../../presentation/hooks/useAddresses';
import { useAuth } from '../../context/AuthContext';
import './AddressesPage.css';
import '../../components/address/address-components.css';

function AddressesPageInner() {
  const { user } = useAuth();
  const {
    addresses,
    loading,
    error,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
  } = useAddresses();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const initialForm = useMemo(() => {
    if (editingId) {
      const address = addresses.find((a) => a.id === editingId);
      if (!address) return EMPTY_ADDRESS_FORM;
      return {
        label: address.label,
        fullName: address.fullName,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2 || '',
        landmark: address.landmark || '',
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        country: address.country || 'India',
        formattedAddress: address.formattedAddress || '',
        latitude: address.latitude,
        longitude: address.longitude,
        isDefault: address.isDefault,
      };
    }
    return {
      ...EMPTY_ADDRESS_FORM,
      fullName: user?.fullName || '',
      phone: user?.phone || '',
      isDefault: addresses.length === 0,
    };
  }, [editingId, addresses, user?.fullName, user?.phone]);

  function openAdd() {
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(address) {
    setEditingId(address.id);
    setFormOpen(true);
  }

  async function handleSave(form) {
    setSaving(true);
    try {
      if (editingId) {
        await updateAddress(editingId, form);
      } else {
        await createAddress(form);
      }
      setFormOpen(false);
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell animate-in">
      <Navbar showLocation={false} />
      <main className="page-container addresses-page">
        <div className="page-header">
          <Link to="/profile" className="back-btn" aria-label="Go back">
            <IconBack />
          </Link>
          <h1>Saved addresses</h1>
          <button type="button" className="btn btn-primary btn-sm" onClick={openAdd}>
            Add
          </button>
        </div>

        {loading && <p className="muted">Loading addresses…</p>}
        {error && <p className="form-error">{error}</p>}

        {!loading && (
          <AddressList
            addresses={addresses}
            onEdit={openEdit}
            onDelete={deleteAddress}
            onSetDefault={setDefaultAddress}
          />
        )}

        <AddressModal
          key={editingId || 'new'}
          open={formOpen}
          mode={editingId ? 'edit' : 'add'}
          initialForm={initialForm}
          saving={saving}
          onSave={handleSave}
          onClose={() => {
            setFormOpen(false);
            setEditingId(null);
          }}
        />      </main>
    </div>
  );
}

export default function AddressesPage() {
  return (
    <RequireAuth>
      <AddressesPageInner />
    </RequireAuth>
  );
}

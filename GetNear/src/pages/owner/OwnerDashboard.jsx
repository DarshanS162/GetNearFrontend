import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCatalog } from '../../context/CatalogContext';
import { BUSINESS_STATUS, BUSINESS_STATUS_LABELS } from '../../domain/restaurant';
import { partnerUseCases } from '../../application/container';
import { useState } from 'react';

export default function OwnerDashboard() {
  const { user } = useAuth();
  const { getBusiness, products, refreshCatalog } = useCatalog();
  const restaurant = getBusiness(user?.restaurantId);
  const itemCount = products.filter((p) => p.businessId === user?.restaurantId).length;
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');

  if (!restaurant) {
    return (
      <div className="admin-page-header">
        <h1>Welcome, partner</h1>
        <p>No restaurant linked yet. Apply to list your store on GetNear.</p>
        <Link to="/partner" className="btn btn-primary" style={{ marginTop: 12 }}>
          Apply as restaurant partner
        </Link>
      </div>
    );
  }

  const pending = restaurant.businessStatus === BUSINESS_STATUS.PENDING_APPROVAL;
  const rejected = restaurant.businessStatus === BUSINESS_STATUS.REJECTED;
  const canToggle = restaurant.businessStatus === BUSINESS_STATUS.ACTIVE;

  async function handleToggleOpen() {
    if (!canToggle) return;
    setToggling(true);
    setError('');
    try {
      await partnerUseCases.setOpen.execute(restaurant.id, !restaurant.isOpen);
      await refreshCatalog();
    } catch (err) {
      setError(err.message || 'Could not update status');
    } finally {
      setToggling(false);
    }
  }

  return (
    <>
      <div className="admin-page-header admin-page-header-row">
        <div>
          <h1>{restaurant.name}</h1>
          <p>
            {BUSINESS_STATUS_LABELS[restaurant.businessStatus] || restaurant.businessStatus}
            {canToggle && <> · {restaurant.isOpen ? 'Open for orders' : 'Closed'}</>}
          </p>
        </div>
        {canToggle && (
          <button
            type="button"
            className={`btn ${restaurant.isOpen ? 'btn-secondary' : 'btn-primary'}`}
            onClick={handleToggleOpen}
            disabled={toggling}
          >
            {toggling ? 'Updating…' : restaurant.isOpen ? 'Close store' : 'Open store'}
          </button>
        )}
      </div>

      {error && (
        <div className="card" style={{ padding: 12, marginBottom: 16, color: '#ef4444' }}>
          {error}
        </div>
      )}

      {pending && (
        <div className="card" style={{ padding: 16, marginBottom: 16, background: 'rgba(255,159,28,0.12)' }}>
          <strong>Pending admin approval</strong>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--color-text-secondary)' }}>
            Your store is not visible to customers yet. You can still prepare your menu and settings.
          </p>
        </div>
      )}

      {rejected && (
        <div className="card" style={{ padding: 16, marginBottom: 16, color: '#ef4444' }}>
          Application rejected{restaurant.rejectionReason ? `: ${restaurant.rejectionReason}` : '.'}
        </div>
      )}

      <div className="admin-stats">
        <div className="admin-stat-card card">
          <span>Menu items</span>
          <strong>{itemCount}</strong>
        </div>
        <div className="admin-stat-card card">
          <span>Status</span>
          <strong style={{ fontSize: 18 }}>
            {canToggle ? (restaurant.isOpen ? 'Open' : 'Closed') : BUSINESS_STATUS_LABELS[restaurant.businessStatus]}
          </strong>
        </div>
        <div className="admin-stat-card card">
          <span>Location</span>
          <strong style={{ fontSize: 16 }}>{restaurant.location || '—'}</strong>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link to="/owner/orders" className="btn btn-primary">Orders</Link>
        <Link to="/owner/menu" className="btn btn-secondary">Menu</Link>
        <Link to="/owner/settings" className="btn btn-secondary">Store settings</Link>
      </div>
    </>
  );
}

import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCatalog } from '../../context/CatalogContext';
import { BUSINESS_STATUS, BUSINESS_STATUS_LABELS } from '../../domain/restaurant';
import { partnerUseCases } from '../../application/container';
import { useState } from 'react';
import {
  IconOrders,
  IconMenuBoard,
  IconSettings,
  IconLocation,
} from '../../components/ui/Icons';
import './OwnerLayout.css';

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
  const isOpen = canToggle && restaurant.isOpen;

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
    <div className="owner-dashboard">
      <section className="owner-hero-card card">
        <div className="owner-hero-top">
          <div className="owner-hero-copy">
            <p className="owner-hero-eyebrow">Your store</p>
            <h1>{restaurant.name}</h1>
            <p className="owner-hero-sub">
              {restaurant.location || 'Location not set'}
              {restaurant.type ? ` · ${restaurant.type}` : ''}
            </p>
          </div>
          <span
            className={`owner-status-pill ${
              rejected
                ? 'owner-status-pill--danger'
                : pending
                  ? 'owner-status-pill--warn'
                  : isOpen
                    ? 'owner-status-pill--success'
                    : 'owner-status-pill--muted'
            }`}
          >
            {rejected
              ? 'Rejected'
              : pending
                ? 'Pending'
                : isOpen
                  ? 'Open now'
                  : canToggle
                    ? 'Closed'
                    : BUSINESS_STATUS_LABELS[restaurant.businessStatus]}
          </span>
        </div>

        {canToggle && (
          <button
            type="button"
            className={`btn ${isOpen ? 'btn-secondary' : 'btn-primary'} owner-hero-toggle`}
            onClick={handleToggleOpen}
            disabled={toggling}
          >
            {toggling ? 'Updating…' : isOpen ? 'Close store' : 'Open store'}
          </button>
        )}
      </section>

      {error && <div className="owner-alert owner-alert--danger">{error}</div>}

      {pending && (
        <div className="owner-alert owner-alert--warn">
          <strong>Pending admin approval</strong>
          <p>Your store is not visible to customers yet. You can still prepare menu and settings.</p>
        </div>
      )}

      {rejected && (
        <div className="owner-alert owner-alert--danger">
          Application rejected{restaurant.rejectionReason ? `: ${restaurant.rejectionReason}` : '.'}
        </div>
      )}

      <div className="owner-stat-grid">
        <div className="owner-stat card">
          <span className="owner-stat-label">Menu items</span>
          <strong className="owner-stat-value">{itemCount}</strong>
        </div>
        <div className="owner-stat card">
          <span className="owner-stat-label">Store status</span>
          <strong className="owner-stat-value owner-stat-value--sm">
            {canToggle ? (isOpen ? 'Open' : 'Closed') : BUSINESS_STATUS_LABELS[restaurant.businessStatus]}
          </strong>
        </div>
        <div className="owner-stat card owner-stat--wide">
          <span className="owner-stat-label">
            <IconLocation size={14} /> Location
          </span>
          <strong className="owner-stat-value owner-stat-value--sm">
            {restaurant.location || '—'}
          </strong>
        </div>
      </div>

      <p className="owner-section-title">Quick actions</p>
      <div className="owner-quick-grid">
        <Link to="/owner/orders" className="owner-quick-card card">
          <span className="owner-quick-icon owner-quick-icon--orders">
            <IconOrders size={20} />
          </span>
          <strong>Orders</strong>
          <span>Manage incoming COD orders</span>
        </Link>
        <Link to="/owner/menu" className="owner-quick-card card">
          <span className="owner-quick-icon owner-quick-icon--menu">
            <IconMenuBoard size={20} />
          </span>
          <strong>Menu</strong>
          <span>Add or edit dishes</span>
        </Link>
        <Link to="/owner/settings" className="owner-quick-card card">
          <span className="owner-quick-icon owner-quick-icon--store">
            <IconSettings size={20} />
          </span>
          <strong>Store</strong>
          <span>Update store details</span>
        </Link>
      </div>
    </div>
  );
}

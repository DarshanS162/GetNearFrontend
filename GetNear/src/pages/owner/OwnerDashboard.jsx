import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCatalog } from '../../context/CatalogContext';

export default function OwnerDashboard() {
  const { user } = useAuth();
  const { getBusiness, products } = useCatalog();
  const restaurant = getBusiness(user?.restaurantId);
  const itemCount = products.filter((p) => p.businessId === user?.restaurantId).length;

  if (!restaurant) {
    return (
      <div className="admin-page-header">
        <h1>Restaurant not found</h1>
        <p>Contact platform admin to link your account to a restaurant.</p>
      </div>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1>{restaurant.name}</h1>
        <p>Manage your menu and keep your store listing up to date.</p>
      </div>

      <div className="admin-stats">
        <div className="admin-stat-card card">
          <span>Menu items</span>
          <strong>{itemCount}</strong>
        </div>
        <div className="admin-stat-card card">
          <span>Status</span>
          <strong style={{ fontSize: 18 }}>{restaurant.isOpen ? 'Open' : 'Closed'}</strong>
        </div>
        <div className="admin-stat-card card">
          <span>Location</span>
          <strong style={{ fontSize: 16 }}>{restaurant.location || '—'}</strong>
        </div>
      </div>

      <div className="card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
        <h2 style={{ fontSize: 16, marginBottom: 'var(--space-3)' }}>Store details</h2>
        <p style={{ margin: '0 0 8px', fontSize: 14 }}><strong>Cuisine:</strong> {restaurant.type || '—'}</p>
        <p style={{ margin: '0 0 8px', fontSize: 14 }}><strong>Phone:</strong> {restaurant.contactPhone || '—'}</p>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)' }}>
          {restaurant.description || 'No description yet.'}
        </p>
      </div>

      <Link to="/owner/menu" className="btn btn-primary">
        Manage my menu
      </Link>
    </>
  );
}

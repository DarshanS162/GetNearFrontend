import { Link } from 'react-router-dom';
import { useCatalog } from '../../context/CatalogContext';

export default function AdminDashboard() {
  const { businesses, products } = useCatalog();

  return (
    <>
      <div className="admin-page-header">
        <h1>Dashboard</h1>
        <p>Platform admin — add any restaurant and manage all menus.</p>
      </div>

      <div className="card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 16, marginBottom: 'var(--space-3)' }}>Who can manage menus?</h2>
        <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--color-text-secondary)', fontSize: 14, lineHeight: 1.7 }}>
          <li><strong>Admin (you):</strong> add restaurants + menu items for any store</li>
          <li><strong>Restaurant owner:</strong> manages menu for their own store only (login with owner mobile)</li>
        </ul>
      </div>

      <div className="admin-stats">
        <div className="admin-stat-card card">
          <span>Restaurants</span>
          <strong>{businesses.length}</strong>
        </div>
        <div className="admin-stat-card card">
          <span>Menu items</span>
          <strong>{products.length}</strong>
        </div>
        <div className="admin-stat-card card">
          <span>Active stores</span>
          <strong>{businesses.filter((b) => b.isOpen).length}</strong>
        </div>
      </div>

      <div className="card" style={{ padding: 'var(--space-5)' }}>
        <h2 style={{ fontSize: 16, marginBottom: 'var(--space-4)' }}>Quick actions</h2>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Link to="/admin/restaurants" className="btn btn-primary">
            Add restaurant
          </Link>
          <Link to="/admin/products" className="btn btn-secondary">
            Manage all menu items
          </Link>
          <Link to="/" className="btn btn-ghost">
            View customer app
          </Link>
        </div>
      </div>
    </>
  );
}

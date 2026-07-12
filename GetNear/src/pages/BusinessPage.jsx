import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useCatalog } from '../context/CatalogContext';
import { SearchBar, QuantityControl, StickyCartBar } from '../components/ui/Shared';
import { IconBack, IconStar, IconClock, IconBike } from '../components/ui/Icons';
import './BusinessPage.css';

export default function BusinessPage() {
  const { id } = useParams();
  const { getBusiness, getBusinessProducts, menuCategories, loading } = useCatalog();
  const business = getBusiness(id);
  const businessCategories = menuCategories.filter((c) => c.restaurantId === id);
  const [activeCategory, setActiveCategory] = useState('');
  const [search, setSearch] = useState('');
  const { addItem, removeItem, getQuantity, itemCount, total } = useCart();

  if (loading) {
    return <div className="page-container" style={{ paddingTop: 48 }}>Loading menu…</div>;
  }

  if (!business) {
    return <div className="page-container" style={{ paddingTop: 48 }}>Business not found</div>;
  }

  const selectedCategory = activeCategory || businessCategories[0]?.id;
  let menuItems = getBusinessProducts(id, selectedCategory);
  if (search.trim()) {
    const q = search.toLowerCase();
    menuItems = getBusinessProducts(id).filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
  }

  return (
    <div className="app-shell animate-in business-page">
      <main className="page-container">
        <div className="business-header-nav">
          <Link to="/" className="back-btn" aria-label="Go back">
            <IconBack />
          </Link>
        </div>

        <div
          className="business-hero-banner"
          style={{ background: business.bannerColor }}
        >
          <span className="business-hero-icon">{business.icon}</span>
        </div>

        <div className="business-detail card">
          <div className="business-detail-top">
            <div>
              <h1>{business.name}</h1>
              <p className="business-subtitle">
                {business.type} · {business.location}
              </p>
            </div>
            {business.isOpen && (
              <span className="badge badge-success">Open now</span>
            )}
          </div>

          <div className="business-stats-row">
            <div className="stat">
              <IconStar size={14} filled />
              <span>{business.rating} ({(business.reviews / 1000).toFixed(1)}k)</span>
            </div>
            <div className="stat">
              <IconClock size={14} />
              <span>{business.deliveryTime} min</span>
            </div>
            <div className="stat">
              <IconBike size={14} />
              <span>Free above ₹{business.freeDeliveryAbove}</span>
            </div>
          </div>
        </div>

        <div className="menu-search">
          <SearchBar
            placeholder="Search menu"
            value={search}
            onChange={setSearch}
          />
        </div>

        <div className="chips-row menu-chips">
          {businessCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`chip ${selectedCategory === cat.id ? 'chip-active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="menu-list">
          {menuItems.map((item) => {
            const qty = getQuantity(item.id);
            return (
              <div key={item.id} className="menu-item card">
                <div className="menu-item-info">
                  <Link to={`/product/${item.id}`}>
                    <h3>{item.name}</h3>
                  </Link>
                  <p>{item.description}</p>
                  <span className="menu-price">₹{item.price}</span>
                </div>
                <QuantityControl
                  quantity={qty}
                  onAdd={() => addItem(item.id)}
                  onRemove={() => removeItem(item.id)}
                />
              </div>
            );
          })}
        </div>

        <div className="bottom-spacer" />
        <StickyCartBar itemCount={itemCount} total={total} />
      </main>
    </div>
  );
}

import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';
import { SearchBar } from '../../components/ui/Shared';
import { IconStar } from '../../components/ui/Icons';
import { useMemo } from 'react';
import { useCatalog } from '../../context/CatalogContext';
import { useAuth } from '../../context/AuthContext';
import { categories } from '../../data/mockData';
import { isCustomerVisible } from '../../domain/restaurant';
import './HomePage.css';

export default function HomePage() {
  const { businesses, trendingDishes, loading, error } = useCatalog();
  const { loading: authLoading, isAdmin, isRestaurantOwner } = useAuth();
  const [searchParams] = useSearchParams();
  const customerView = searchParams.get('view') === 'customer';
  const liveBusinesses = useMemo(
    () => businesses.filter(isCustomerVisible),
    [businesses],
  );

  // Owners/admins land on their panel by default; ?view=customer keeps customer browse.
  if (!authLoading && !customerView && isAdmin) {
    return <Navigate to="/admin" replace />;
  }
  if (!authLoading && !customerView && isRestaurantOwner) {
    return <Navigate to="/owner" replace />;
  }

  return (
    <div className="app-shell animate-in">
      <Navbar />
      <main className="page-container home-page">
        <section className="hero">
          <h1>
            Great food,
            <br />
            <span className="hero-accent">right nearby</span>
          </h1>
          <p>Order from trusted local businesses in minutes</p>
          <SearchBar placeholder="Search restaurants, dishes, stores..." />
        </section>

        {error && (
          <div className="empty-state card" style={{ marginBottom: 24 }}>
            <p>Could not load stores from Supabase.</p>
            <span className="empty-state-sub">{error}</span>
          </div>
        )}

        {loading && (
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24 }}>
            Loading nearby stores…
          </p>
        )}

        <section className="home-section">
          <h2 className="section-title">Popular categories</h2>
          <div className="category-grid">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className="category-item"
                style={{ '--cat-bg': cat.bg, '--cat-color': cat.color }}
              >
                <span className="category-icon">{cat.icon}</span>
                <span className="category-name">{cat.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="home-section">
          <div className="section-header">
            <h2 className="section-title" style={{ margin: 0 }}>Featured near you</h2>
          </div>
          {liveBusinesses.length === 0 ? (
            <div className="empty-state card">
              <p>No stores nearby yet.</p>
              <span className="empty-state-sub">
                We&apos;re adding local businesses in your area. Check back soon!
              </span>
            </div>
          ) : (
            <div className="business-scroll">
              {liveBusinesses.map((biz) => (
                <Link
                  key={biz.id}
                  to={`/business/${biz.id}`}
                  className="business-card card card-interactive"
                >
                  {biz.offer && (
                    <span className="badge badge-success business-offer">{biz.offer}</span>
                  )}
                  <div
                    className="business-banner"
                    style={{ background: biz.bannerColor }}
                  >
                    {biz.bannerUrl ? (
                      <img src={biz.bannerUrl} alt="" className="business-banner-img" />
                    ) : (
                      <span className="business-emoji">{biz.icon}</span>
                    )}
                  </div>
                  <div className="business-info">
                    <h3>
                      {biz.name}
                      {!biz.isOpen && (
                        <span className="badge" style={{ marginLeft: 8, fontSize: 11 }}>
                          Closed
                        </span>
                      )}
                    </h3>
                    <p className="business-meta">{biz.type}</p>
                    <p className="business-stats">
                      <IconStar size={12} filled /> {biz.rating} · {biz.deliveryTime} min
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {trendingDishes.length > 0 && (
        <section className="home-section">
          <h2 className="section-title">Trending dishes</h2>
          <div className="trending-scroll">
            {trendingDishes.map((dish) => (
              <Link
                key={dish.id}
                to={`/product/${dish.id}`}
                className="trending-card card card-interactive"
              >
                <span className="trending-emoji">
                  {dish.imageUrl ? (
                    <img src={dish.imageUrl} alt="" className="trending-img" />
                  ) : (
                    dish.emoji
                  )}
                </span>
                <span className="trending-name">{dish.name}</span>
                <span className="trending-price">₹{dish.price}</span>
              </Link>
            ))}
          </div>
        </section>
        )}

        <section className="home-section">
          <div className="offer-banner card">
            <div>
              <span className="badge badge-secondary">Limited time</span>
              <h3>Flat 20% off</h3>
              <p>On your first order above ₹299</p>
            </div>
            <span className="offer-emoji">🎉</span>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}

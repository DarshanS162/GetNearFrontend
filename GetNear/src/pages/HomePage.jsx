import { Link } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { SearchBar } from '../components/ui/Shared';
import { IconStar } from '../components/ui/Icons';
import { useCatalog } from '../context/CatalogContext';
import { categories } from '../data/mockData';
import './HomePage.css';

export default function HomePage() {
  const { businesses, trendingDishes } = useCatalog();
  return (
    <div className="app-shell animate-in">
      <Navbar />
      <main className="page-container home-page">
        <section className="hero">
          <h1>Great food,<br />right nearby</h1>
          <p>Order from trusted local businesses in minutes</p>
          <SearchBar placeholder="Search restaurants, dishes, stores..." />
        </section>

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
          {businesses.length === 0 ? (
            <div className="empty-state card">
              <p>No stores nearby yet.</p>
              <span className="empty-state-sub">
                We&apos;re adding local businesses in your area. Check back soon!
              </span>
            </div>
          ) : (
            <div className="business-scroll">
              {businesses.map((biz) => (
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
                    <span className="business-emoji">{biz.icon}</span>
                  </div>
                  <div className="business-info">
                    <h3>{biz.name}</h3>
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
                <span className="trending-emoji">{dish.emoji}</span>
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

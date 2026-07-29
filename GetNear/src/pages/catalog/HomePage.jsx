import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';
import { SearchBar } from '../../components/ui/Shared';
import { IconStar, IconClock, IconBike } from '../../components/ui/Icons';
import { useMemo } from 'react';
import { useCatalog } from '../../context/CatalogContext';
import { useAuth } from '../../context/AuthContext';
import { isCustomerVisible } from '../../domain/restaurant';
import './HomePage.css';

function StoreCardSkeleton() {
  return (
    <div className="home-store-card home-store-card--skeleton" aria-hidden="true">
      <div className="home-store-media home-skel" />
      <div className="home-store-body">
        <div className="home-skel home-skel-line" />
        <div className="home-skel home-skel-line home-skel-line--short" />
      </div>
    </div>
  );
}

export default function HomePage() {
  const { businesses, trendingDishes, loading, error } = useCatalog();
  const { loading: authLoading, isAdmin, isRestaurantOwner } = useAuth();
  const [searchParams] = useSearchParams();
  const customerView = searchParams.get('view') === 'customer';
  const liveBusinesses = useMemo(
    () => businesses.filter(isCustomerVisible),
    [businesses],
  );
  const openCount = useMemo(
    () => liveBusinesses.filter((b) => b.isOpen).length,
    [liveBusinesses],
  );

  if (!authLoading && !customerView && isAdmin) {
    return <Navigate to="/admin" replace />;
  }
  if (!authLoading && !customerView && isRestaurantOwner) {
    return <Navigate to="/owner" replace />;
  }

  return (
    <div className="app-shell home-shell animate-in">
      <Navbar />
      <main className="page-container home-page">
        <section className="home-hero">
          <p className="home-hero-kicker">GetNear</p>
          <h1>
            Great food,
            <br />
            <span className="home-hero-accent">right nearby</span>
          </h1>
          <p className="home-hero-sub">
            Order from trusted local kitchens — fast delivery to your door.
          </p>
          <div className="home-hero-search">
            <SearchBar placeholder="Search restaurants or dishes…" />
          </div>
        </section>

        {error && (
          <div className="home-alert">
            <strong>Couldn’t load stores</strong>
            <span>{error}</span>
          </div>
        )}

        <section className="home-section">
          <div className="home-section-head">
            <div>
              <h2>Nearby stores</h2>
              <p>
                {loading
                  ? 'Finding places around you…'
                  : liveBusinesses.length === 0
                    ? 'New kitchens joining soon'
                    : `${openCount} open · ${liveBusinesses.length} nearby`}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="home-store-scroll">
              <StoreCardSkeleton />
              <StoreCardSkeleton />
              <StoreCardSkeleton />
            </div>
          ) : liveBusinesses.length === 0 ? (
            <div className="home-empty">
              <strong>No stores nearby yet</strong>
              <p>We’re onboarding local restaurants in your area. Check back soon.</p>
            </div>
          ) : (
            <div className="home-store-scroll">
              {liveBusinesses.map((biz) => (
                <Link
                  key={biz.id}
                  to={`/business/${biz.id}`}
                  className={`home-store-card${!biz.isOpen ? ' home-store-card--closed' : ''}`}
                >
                  <div
                    className="home-store-media"
                    style={{ background: biz.bannerColor || '#FFF0E8' }}
                  >
                    {biz.bannerUrl ? (
                      <img src={biz.bannerUrl} alt="" />
                    ) : (
                      <span className="home-store-fallback">{biz.icon || '🍽️'}</span>
                    )}
                    <span className={`home-store-status ${biz.isOpen ? 'is-open' : 'is-closed'}`}>
                      {biz.isOpen ? 'Open' : 'Closed'}
                    </span>
                  </div>
                  <div className="home-store-body">
                    <h3>{biz.name}</h3>
                    <p className="home-store-meta">
                      {[biz.type, biz.location].filter(Boolean).join(' · ') || 'Local kitchen'}
                    </p>
                    <div className="home-store-stats">
                      <span>
                        <IconStar size={12} filled /> {biz.rating}
                      </span>
                      <span>
                        <IconClock size={12} /> {biz.deliveryTime} min
                      </span>
                      <span>
                        <IconBike size={12} /> Free ₹{biz.freeDeliveryAbove}+
                      </span>
                    </div>
                    {biz.offer && <p className="home-store-offer">{biz.offer}</p>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {trendingDishes.length > 0 && (
          <section className="home-section">
            <div className="home-section-head">
              <div>
                <h2>Popular right now</h2>
                <p>Dishes people are ordering nearby</p>
              </div>
            </div>
            <div className="home-dish-scroll">
              {trendingDishes.map((dish) => (
                <Link key={dish.id} to={`/product/${dish.id}`} className="home-dish-card">
                  <div className="home-dish-media">
                    {dish.imageUrl ? (
                      <img src={dish.imageUrl} alt="" />
                    ) : (
                      <span>{dish.emoji || '🍽️'}</span>
                    )}
                  </div>
                  <div className="home-dish-body">
                    <strong>{dish.name}</strong>
                    <span>₹{dish.price}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="home-section">
          <div className="home-promo">
            <div>
              <p className="home-promo-label">First order</p>
              <h3>Save on your first GetNear meal</h3>
              <p>Enjoy a welcome discount when you order above ₹299.</p>
            </div>
            <Link to={liveBusinesses[0] ? `/business/${liveBusinesses[0].id}` : '/'} className="btn btn-primary">
              Order now
            </Link>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useCatalog } from '../../context/CatalogContext';
import { useAuth } from '../../context/AuthContext';
import { SearchBar, QuantityControl, FloatingCartFab } from '../../components/ui/Shared';
import { IconBack, IconStar, IconClock, IconBike } from '../../components/ui/Icons';
import { isCustomerVisible, isStoreOpen } from '../../domain/restaurant';
import {
  PRICING_OPTION,
  formatPriceSummary,
  isFullHalf,
  resolveUnitPrice,
} from '../../domain/productPricing';
import './BusinessPage.css';

function FoodTypeMark({ type }) {
  const label =
    type === 'non_veg' ? 'Non veg' : type === 'egg' ? 'Egg' : 'Veg';
  const tone =
    type === 'non_veg' ? 'nonveg' : type === 'egg' ? 'egg' : 'veg';
  return (
    <span className={`menu-food-type menu-food-type--${tone}`} title={label} aria-label={label}>
      <i />
    </span>
  );
}

export default function BusinessPage() {
  const { id } = useParams();
  const { getBusiness, getBusinessProducts, menuCategories, loading } = useCatalog();
  const { isAdmin, user } = useAuth();
  const business = getBusiness(id);
  const businessCategories = useMemo(
    () => menuCategories.filter((c) => c.restaurantId === id),
    [menuCategories, id],
  );
  const [activeCategory, setActiveCategory] = useState('');
  const [search, setSearch] = useState('');
  const { addItem, removeItem, getQuantity, itemCount, total } = useCart();

  if (loading) {
    return (
      <div className="app-shell business-shell">
        <main className="page-container business-page">
          <div className="business-skel-hero" />
          <div className="business-skel-card" />
          <div className="business-skel-line" />
          <div className="business-skel-line business-skel-line--short" />
        </main>
      </div>
    );
  }

  const canPreview =
    isAdmin || (user?.restaurantId && user.restaurantId === id);

  if (!business || (!isCustomerVisible(business) && !canPreview)) {
    return (
      <div className="app-shell business-shell">
        <main className="page-container business-page">
          <div className="business-unavailable">
            <strong>This store isn’t available yet</strong>
            <p>It may still be under review or temporarily hidden.</p>
            <Link to="/" className="btn btn-primary">
              Back to home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const storeOpen = isStoreOpen(business);
  const selectedCategory = activeCategory || businessCategories[0]?.id || '';
  const searching = Boolean(search.trim());

  let menuItems = searching
    ? getBusinessProducts(id).filter((p) => {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
        );
      })
    : getBusinessProducts(id, selectedCategory);

  const categoryLabel =
    businessCategories.find((c) => c.id === selectedCategory)?.name || 'Menu';

  return (
    <div className="app-shell business-shell">
      <main className="page-container business-page animate-in">
        <div className="business-topbar">
          <Link to="/" className="back-btn" aria-label="Go back">
            <IconBack />
          </Link>
        </div>

        <section className="business-hero">
          <div
            className="business-hero-banner"
            style={{ background: business.bannerColor || '#FFF0E8' }}
          >
            {business.bannerUrl ? (
              <img src={business.bannerUrl} alt="" className="business-hero-img" />
            ) : (
              <span className="business-hero-icon">{business.icon || '🍽️'}</span>
            )}
            <div className="business-hero-fade" />
          </div>

          <div className="business-detail">
            <div className="business-detail-top">
              <div>
                <h1>{business.name}</h1>
                <p className="business-subtitle">
                  {[business.type, business.location].filter(Boolean).join(' · ') ||
                    'Local kitchen'}
                </p>
              </div>
              <span className={`business-open-pill ${storeOpen ? 'is-open' : 'is-closed'}`}>
                {storeOpen ? 'Open now' : 'Closed'}
              </span>
            </div>

            {business.description && (
              <p className="business-desc">{business.description}</p>
            )}

            {!storeOpen && (
              <p className="business-closed-note">
                This store is closed right now and isn’t accepting orders.
              </p>
            )}

            <div className="business-stats-row">
              <div className="stat">
                <IconStar size={14} filled />
                <span>{business.rating}</span>
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

            {business.offer && (
              <p className="business-offer-line">{business.offer}</p>
            )}
          </div>
        </section>

        <div className="menu-toolbar">
          <SearchBar
            placeholder="Search this menu…"
            value={search}
            onChange={setSearch}
          />
        </div>

        {!searching && businessCategories.length > 0 && (
          <div className="menu-chips chips-row" role="tablist" aria-label="Menu categories">
            {businessCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={selectedCategory === cat.id}
                className={`chip ${selectedCategory === cat.id ? 'chip-active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        <div className="menu-section-label">
          <h2>{searching ? 'Search results' : categoryLabel}</h2>
          <span>
            {menuItems.length} item{menuItems.length === 1 ? '' : 's'}
          </span>
        </div>

        {menuItems.length === 0 ? (
          <div className="menu-empty">
            <strong>{searching ? 'No matching dishes' : 'No items in this category'}</strong>
            <p>
              {searching
                ? 'Try a different search term.'
                : 'Check another category or come back later.'}
            </p>
          </div>
        ) : (
          <div className="menu-list">
            {menuItems.map((item) => {
              const fullHalf = isFullHalf(item);
              if (fullHalf) {
                const fullQty = getQuantity(item.id, PRICING_OPTION.FULL);
                const halfQty = getQuantity(item.id, PRICING_OPTION.HALF);
                return (
                  <article key={item.id} className="menu-item">
                    <div className="menu-item-info">
                      <div className="menu-item-title-row">
                        <FoodTypeMark type={item.foodType} />
                        <Link to={`/product/${item.id}`}>
                          <h3>{item.name}</h3>
                        </Link>
                      </div>
                      <div className="menu-item-price-row">
                        <span className="menu-price">{formatPriceSummary(item)}</span>
                      </div>
                      {item.description && <p>{item.description}</p>}
                      {storeOpen ? (
                        <div className="menu-portion-actions">
                          <div className="menu-portion-row">
                            <span>Full · ₹{resolveUnitPrice(item, PRICING_OPTION.FULL)}</span>
                            <QuantityControl
                              quantity={fullQty}
                              onAdd={() => addItem(item.id, PRICING_OPTION.FULL)}
                              onRemove={() => removeItem(item.id, PRICING_OPTION.FULL)}
                            />
                          </div>
                          <div className="menu-portion-row">
                            <span>Half · ₹{resolveUnitPrice(item, PRICING_OPTION.HALF)}</span>
                            <QuantityControl
                              quantity={halfQty}
                              onAdd={() => addItem(item.id, PRICING_OPTION.HALF)}
                              onRemove={() => removeItem(item.id, PRICING_OPTION.HALF)}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="menu-item-closed">Unavailable</span>
                      )}
                    </div>
                    <Link to={`/product/${item.id}`} className="menu-item-media" aria-label={item.name}>
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" />
                      ) : (
                        <span className="menu-item-media-fallback">🍽️</span>
                      )}
                    </Link>
                  </article>
                );
              }

              const qty = getQuantity(item.id, PRICING_OPTION.PIECE);
              return (
                <article key={item.id} className="menu-item">
                  <div className="menu-item-info">
                    <div className="menu-item-title-row">
                      <FoodTypeMark type={item.foodType} />
                      <Link to={`/product/${item.id}`}>
                        <h3>{item.name}</h3>
                      </Link>
                    </div>
                    <div className="menu-item-price-row">
                      <span className="menu-price">₹{item.price}</span>
                      <span className="menu-unit-tag">1 Pc</span>
                      {item.mrp > item.price && (
                        <span className="menu-mrp">₹{item.mrp}</span>
                      )}
                    </div>
                    {item.description && <p>{item.description}</p>}
                    {storeOpen ? (
                      <div className="menu-item-actions">
                        <QuantityControl
                          quantity={qty}
                          onAdd={() => addItem(item.id, PRICING_OPTION.PIECE)}
                          onRemove={() => removeItem(item.id, PRICING_OPTION.PIECE)}
                        />
                      </div>
                    ) : (
                      <span className="menu-item-closed">Unavailable</span>
                    )}
                  </div>
                  <Link to={`/product/${item.id}`} className="menu-item-media" aria-label={item.name}>
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" />
                    ) : (
                      <span className="menu-item-media-fallback">🍽️</span>
                    )}
                  </Link>
                </article>
              );
            })}
          </div>
        )}

        <div className="bottom-spacer" />
      </main>

      {storeOpen && <FloatingCartFab itemCount={itemCount} total={total} />}
    </div>
  );
}

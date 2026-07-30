import { Link, useParams } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useCatalog } from '../../context/CatalogContext';
import { useAuth } from '../../context/AuthContext';
import { IconBack, IconClock } from '../../components/ui/Icons';
import { QuantityControl, FloatingCartFab } from '../../components/ui/Shared';
import { isCustomerVisible, isStoreOpen } from '../../domain/restaurant';
import './ProductDetailPage.css';

export default function ProductDetailPage() {
  const { id } = useParams();
  const { getProduct, getBusiness, products } = useCatalog();
  const { isAdmin, user } = useAuth();
  const product = getProduct(id);
  const { addItem, removeItem, getQuantity, itemCount, total } = useCart();
  const qty = getQuantity(id);

  if (!product) {
    return <div className="page-container">Product not found</div>;
  }

  const business = getBusiness(product.businessId);
  const canPreview =
    isAdmin || (user?.restaurantId && user.restaurantId === product.businessId);

  if (!business || (!isCustomerVisible(business) && !canPreview)) {
    return (
      <div className="page-container" style={{ paddingTop: 48 }}>
        <p>This item is not available yet.</p>
        <Link to="/" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
          Back to home
        </Link>
      </div>
    );
  }

  const storeOpen = isStoreOpen(business);
  const similar = products
    .filter((p) => p.businessId === product.businessId && p.id !== product.id)
    .slice(0, 3);
  const ingredients = String(product.ingredients || '').trim();
  const lineTotal = product.price * Math.max(qty, 1);
  const showCartBar = storeOpen && itemCount > 0;

  return (
    <div className="app-shell product-shell animate-in">
      <main
        className={`page-container product-page${showCartBar ? ' product-page--with-cart' : ''}${storeOpen ? ' product-page--with-cta' : ''}`}
      >
        <div className="product-topbar">
          <Link to={`/business/${product.businessId}`} className="back-btn" aria-label="Go back">
            <IconBack />
          </Link>
          <div className="product-topbar-copy">
            <h1>{product.name}</h1>
            <p>
              <Link to={`/business/${product.businessId}`}>{business.name}</Link>
            </p>
          </div>
        </div>

        <div className="product-hero">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt="" className="product-hero-img" />
          ) : (
            <span className="product-hero-emoji" aria-hidden="true">
              🍽️
            </span>
          )}
          {product.foodType === 'veg' && (
            <span className="badge badge-success product-veg">Veg</span>
          )}
        </div>

        <div className="product-detail">
          <div className="product-price-row">
            <div className="product-price-group">
              <span className="product-price">₹{product.price}</span>
              {product.mrp > product.price && (
                <span className="product-mrp">₹{product.mrp}</span>
              )}
            </div>
            {product.prepTime != null && (
              <span className="product-prep">
                <IconClock size={14} /> {product.prepTime} min
              </span>
            )}
          </div>

          {product.description?.trim() && (
            <p className="product-desc">{product.description}</p>
          )}

          {!storeOpen && (
            <div className="product-alert" role="status">
              <strong>{business.name} is closed</strong>
              <p>This store is not accepting orders right now.</p>
            </div>
          )}

          {ingredients && (
            <div className="product-section">
              <h3>Ingredients</h3>
              <p>{ingredients}</p>
            </div>
          )}
        </div>

        {similar.length > 0 && (
          <section className="similar-section">
            <h2 className="section-title">Similar products</h2>
            <div className="similar-list">
              {similar.map((item) => (
                <Link
                  key={item.id}
                  to={`/product/${item.id}`}
                  className="similar-card"
                >
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="similar-thumb" />
                  ) : (
                    <span className="similar-fallback" aria-hidden="true">
                      🍴
                    </span>
                  )}
                  <div>
                    <strong>{item.name}</strong>
                    <span>₹{item.price}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {storeOpen && (
        <div className="product-cta-bar">
          {qty === 0 ? (
            <button
              type="button"
              className="btn btn-primary product-cta-add"
              onClick={() => addItem(product.id)}
            >
              Add to cart · ₹{product.price}
            </button>
          ) : (
            <div className="product-cta-active">
              <div className="product-cta-qty-label">
                <span>In your cart</span>
                <strong>₹{lineTotal}</strong>
              </div>
              <QuantityControl
                quantity={qty}
                onAdd={() => addItem(product.id)}
                onRemove={() => removeItem(product.id)}
              />
            </div>
          )}
        </div>
      )}

      {showCartBar && (
        <FloatingCartFab
          itemCount={itemCount}
          total={total}
          className="floating-cart-fab--above-cta"
        />
      )}
    </div>
  );
}

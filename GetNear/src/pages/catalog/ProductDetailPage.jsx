import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useCart } from '../../context/CartContext';
import { useCatalog } from '../../context/CatalogContext';
import { useAuth } from '../../context/AuthContext';
import { IconBack, IconClock } from '../../components/ui/Icons';
import { QuantityControl, FloatingCartFab } from '../../components/ui/Shared';
import { isCustomerVisible, isStoreOpen } from '../../domain/restaurant';
import {
  PRICING_OPTION,
  defaultOption,
  formatPriceSummary,
  hasHalfOption,
  isFullHalf,
  optionLabel,
  resolveUnitPrice,
} from '../../domain/productPricing';
import './ProductDetailPage.css';

export default function ProductDetailPage() {
  const { id } = useParams();
  const { getProduct, getBusiness, products } = useCatalog();
  const { isAdmin, user } = useAuth();
  const product = getProduct(id);
  const { addItem, removeItem, getQuantity, itemCount, total } = useCart();
  const [option, setOption] = useState(() =>
    product ? defaultOption(product) : PRICING_OPTION.PIECE,
  );

  useEffect(() => {
    if (product) setOption(defaultOption(product));
  }, [product?.id, product?.pricingType, product?.halfPrice]);

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
  const unitPrice = resolveUnitPrice(product, option);
  const qty = getQuantity(product.id, option);
  const lineTotal = unitPrice * Math.max(qty, 1);
  const showCartBar = storeOpen && itemCount > 0;
  const fullHalf = isFullHalf(product);
  const showHalf = hasHalfOption(product);

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
              {fullHalf ? (
                <span className="product-price product-price--summary">
                  {formatPriceSummary(product)}
                </span>
              ) : (
                <>
                  <span className="product-price">₹{product.price}</span>
                  <span className="product-unit-tag">1 Pc</span>
                </>
              )}
            </div>
            {product.prepTime != null && (
              <span className="product-prep">
                <IconClock size={14} /> {product.prepTime} min
              </span>
            )}
          </div>

          {fullHalf && showHalf && (
            <div className="product-option-row" role="radiogroup" aria-label="Portion size">
              <button
                type="button"
                className={`product-option ${option === PRICING_OPTION.FULL ? 'is-on' : ''}`}
                aria-pressed={option === PRICING_OPTION.FULL}
                onClick={() => setOption(PRICING_OPTION.FULL)}
              >
                Full · ₹{product.fullPrice ?? product.price}
              </button>
              <button
                type="button"
                className={`product-option ${option === PRICING_OPTION.HALF ? 'is-on' : ''}`}
                aria-pressed={option === PRICING_OPTION.HALF}
                onClick={() => setOption(PRICING_OPTION.HALF)}
              >
                Half · ₹{product.halfPrice}
              </button>
            </div>
          )}

          {fullHalf && !showHalf && (
            <p className="product-unit-tag" style={{ marginBottom: 12 }}>
              Full only · ₹{product.fullPrice ?? product.price}
            </p>
          )}

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
                    <span>{formatPriceSummary(item)}</span>
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
              onClick={() => addItem(product.id, option)}
            >
              Add {optionLabel(option)} · ₹{unitPrice}
            </button>
          ) : (
            <div className="product-cta-active">
              <div className="product-cta-qty-label">
                <span>{optionLabel(option)} in cart</span>
                <strong>₹{lineTotal}</strong>
              </div>
              <QuantityControl
                quantity={qty}
                onAdd={() => addItem(product.id, option)}
                onRemove={() => removeItem(product.id, option)}
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

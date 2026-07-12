import { Link, useParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useCatalog } from '../context/CatalogContext';
import { IconBack } from '../components/ui/Icons';
import { QuantityControl } from '../components/ui/Shared';
import './ProductDetailPage.css';

export default function ProductDetailPage() {
  const { id } = useParams();
  const { getProduct, products } = useCatalog();
  const product = getProduct(id);
  const { addItem, removeItem, getQuantity } = useCart();
  const qty = getQuantity(id);

  if (!product) {
    return <div className="page-container">Product not found</div>;
  }

  const similar = products
    .filter((p) => p.businessId === product.businessId && p.id !== product.id)
    .slice(0, 3);

  return (
    <div className="app-shell animate-in">
      <main className="page-container product-page">
        <div className="page-header">
          <Link to={`/business/${product.businessId}`} className="back-btn" aria-label="Go back">
            <IconBack />
          </Link>
          <h1>{product.name}</h1>
        </div>

        <div className="product-hero card">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt="" className="product-hero-img" />
          ) : (
            <span className="product-hero-emoji">🍽️</span>
          )}
          {product.foodType === 'veg' && (
            <span className="badge badge-success product-veg">Veg</span>
          )}
        </div>

        <div className="product-detail">
          <div className="product-price-row">
            <span className="product-price">₹{product.price}</span>
            {product.mrp > product.price && (
              <span className="product-mrp">₹{product.mrp}</span>
            )}
            <span className="product-prep">{product.prepTime} min</span>
          </div>

          <p className="product-desc">{product.description}</p>

          <div className="product-section card">
            <h3>Ingredients</h3>
            <p>{product.ingredients}</p>
          </div>

          <div className="product-actions">
            <QuantityControl
              quantity={qty}
              onAdd={() => addItem(product.id)}
              onRemove={() => removeItem(product.id)}
            />
            {qty === 0 && (
              <button
                type="button"
                className="btn btn-primary btn-full"
                onClick={() => addItem(product.id)}
              >
                Add to cart · ₹{product.price}
              </button>
            )}
          </div>
        </div>

        <section className="similar-section">
          <h2 className="section-title">Similar products</h2>
          <div className="similar-list">
            {similar.map((item) => (
              <Link key={item.id} to={`/product/${item.id}`} className="similar-card card card-interactive">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="similar-thumb" />
                ) : (
                  <span>🍴</span>
                )}
                <div>
                  <strong>{item.name}</strong>
                  <span>₹{item.price}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

import { createContext, useContext, useMemo, useState } from 'react';
import { deliveryFee, taxRate } from '../data/mockData';
import { useCatalog } from './CatalogContext';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { getBusiness, getProduct } = useCatalog();
  const [businessId, setBusinessId] = useState('');
  const [items, setItems] = useState([]);
  const [coupon, setCoupon] = useState(null);

  const business = getBusiness(businessId);

  const cartItems = useMemo(
    () =>
      items
        .map((item) => {
          const product = getProduct(item.productId);
          if (!product) return null;
          return { ...product, quantity: item.quantity };
        })
        .filter(Boolean),
    [items, getProduct],
  );

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const discount = coupon ? Math.round(subtotal * 0.1) : 0;
  const taxable = subtotal - discount;
  const taxes = Math.round(taxable * taxRate);
  const total = taxable + deliveryFee + taxes;

  function addItem(productId) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === productId
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        );
      }
      const product = getProduct(productId);
      if (product) setBusinessId(product.businessId);
      return [...prev, { productId, quantity: 1 }];
    });
  }

  function removeItem(productId) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        return prev.filter((i) => i.productId !== productId);
      }
      return prev.map((i) =>
        i.productId === productId
          ? { ...i, quantity: i.quantity - 1 }
          : i,
      );
    });
  }

  function getQuantity(productId) {
    return items.find((i) => i.productId === productId)?.quantity ?? 0;
  }

  const value = {
    businessId,
    business,
    items: cartItems,
    itemCount,
    subtotal,
    discount,
    deliveryFee,
    taxes,
    total,
    coupon,
    setCoupon,
    addItem,
    removeItem,
    getQuantity,
    setBusinessId,
  };

  return (
    <CartContext.Provider value={value}>{children}</CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

import { createContext, useContext, useMemo, useState } from 'react';
import { deliveryFee, taxRate } from '../data/mockData';
import { useCatalog } from './CatalogContext';
import { couponUseCases } from '../application/container';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { getBusiness, getProduct } = useCatalog();
  const [businessId, setBusinessId] = useState('');
  const [items, setItems] = useState([]);
  const [coupon, setCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);

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

  const discount = Number(coupon?.discountAmount) || 0;
  const deliveryDiscount = Number(coupon?.deliveryDiscount) || 0;
  const payableDeliveryFee = Math.max(deliveryFee - deliveryDiscount, 0);
  const taxable = subtotal - discount;
  const taxes = Math.round(taxable * taxRate);
  const total = Math.max(taxable + payableDeliveryFee + taxes, 0);

  function resetCoupon() {
    setCoupon(null);
    setCouponError('');
  }

  function addItem(productId) {
    resetCoupon();
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
    resetCoupon();
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

  function clearCart() {
    setItems([]);
    setBusinessId('');
    setCoupon(null);
    setCouponError('');
  }

  async function applyCoupon(code) {
    setApplyingCoupon(true);
    setCouponError('');
    try {
      const quote = await couponUseCases.validate.execute({
        code,
        restaurantId: businessId,
        subtotal,
        deliveryCharge: deliveryFee,
        items: cartItems.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
      });
      setCoupon(quote);
      return quote;
    } catch (err) {
      setCoupon(null);
      setCouponError(err.message || 'Coupon is not valid');
      throw err;
    } finally {
      setApplyingCoupon(false);
    }
  }

  const value = {
    businessId,
    business,
    items: cartItems,
    itemCount,
    subtotal,
    discount,
    deliveryFee: payableDeliveryFee,
    originalDeliveryFee: deliveryFee,
    deliveryDiscount,
    taxes,
    total,
    coupon,
    couponError,
    applyingCoupon,
    applyCoupon,
    removeCoupon: resetCoupon,
    addItem,
    removeItem,
    getQuantity,
    setBusinessId,
    clearCart,
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

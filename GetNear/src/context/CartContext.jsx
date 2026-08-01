import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { deliveryFee as fallbackDeliveryFee, taxRate as fallbackTaxRate } from '../data/mockData';
import { useCatalog } from './CatalogContext';
import { couponUseCases } from '../application/container';
import { supabase } from '../lib/supabase';
import {
  clearStoredCart,
  readStoredCart,
  writeStoredCart,
} from '../lib/cartStorage';
import {
  cartLineKey,
  formatLineName,
  normalizeOption,
  optionLabel,
  resolveUnitPrice,
} from '../domain/productPricing';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { getBusiness, getProduct, loading: catalogLoading } = useCatalog();
  const [businessId, setBusinessId] = useState(() => readStoredCart().businessId);
  const [items, setItems] = useState(() => readStoredCart().items);
  const [coupon, setCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [baseDeliveryFee, setBaseDeliveryFee] = useState(fallbackDeliveryFee);
  const [taxRate, setTaxRate] = useState(fallbackTaxRate);
  const [hydrated, setHydrated] = useState(false);

  const business = getBusiness(businessId);

  useEffect(() => {
    if (catalogLoading) return;
    setItems((prev) => {
      const next = prev.filter((row) => Boolean(getProduct(row.productId)));
      if (next.length === prev.length) return prev;
      if (next.length === 0) setBusinessId('');
      return next;
    });
    setHydrated(true);
  }, [catalogLoading, getProduct]);

  useEffect(() => {
    if (!hydrated && catalogLoading) return;
    writeStoredCart({ businessId, items });
  }, [businessId, items, hydrated, catalogLoading]);

  const cartItems = useMemo(
    () =>
      items
        .map((row) => {
          const product = getProduct(row.productId);
          if (!product) return null;
          const option = normalizeOption(product, row.option);
          const unitPrice = resolveUnitPrice(product, option);
          return {
            ...product,
            option,
            optionLabel: optionLabel(option),
            lineName: formatLineName(product.name, option),
            price: unitPrice,
            quantity: row.quantity,
            lineKey: cartLineKey(product.id, option),
          };
        })
        .filter(Boolean),
    [items, getProduct],
  );

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  useEffect(() => {
    let cancelled = false;
    async function loadPricing() {
      if (!businessId) {
        setBaseDeliveryFee(fallbackDeliveryFee);
        setTaxRate(fallbackTaxRate);
        return;
      }
      try {
        const [{ data: fee }, { data: rate }] = await Promise.all([
          supabase.rpc('quote_delivery_charge', {
            p_restaurant_id: businessId,
            p_subtotal: Math.max(subtotal, 0),
          }),
          supabase.rpc('get_restaurant_tax_rate', {
            p_restaurant_id: businessId,
          }),
        ]);
        if (cancelled) return;
        if (fee != null && Number.isFinite(Number(fee))) {
          setBaseDeliveryFee(Number(fee));
        } else {
          setBaseDeliveryFee(fallbackDeliveryFee);
        }
        if (rate != null && Number.isFinite(Number(rate))) {
          setTaxRate(Number(rate));
        } else {
          setTaxRate(fallbackTaxRate);
        }
      } catch {
        if (!cancelled) {
          setBaseDeliveryFee(fallbackDeliveryFee);
          setTaxRate(fallbackTaxRate);
        }
      }
    }
    loadPricing();
    return () => {
      cancelled = true;
    };
  }, [businessId, subtotal]);

  const discount = Number(coupon?.discountAmount) || 0;
  const deliveryDiscount = Number(coupon?.deliveryDiscount) || 0;
  const payableDeliveryFee = Math.max(baseDeliveryFee - deliveryDiscount, 0);
  const taxable = subtotal - discount;
  const taxes = Math.round(taxable * taxRate);
  const total = Math.max(taxable + payableDeliveryFee + taxes, 0);

  function resetCoupon() {
    setCoupon(null);
    setCouponError('');
  }

  function addItem(productId, option) {
    resetCoupon();
    const product = getProduct(productId);
    if (!product) return;
    const resolved = normalizeOption(product, option);

    setItems((prev) => {
      if (businessId && product.businessId !== businessId) {
        setBusinessId(product.businessId);
        return [{ productId, quantity: 1, option: resolved }];
      }

      setBusinessId(product.businessId);
      const existing = prev.find(
        (i) => i.productId === productId && i.option === resolved,
      );
      if (existing) {
        return prev.map((i) =>
          i.productId === productId && i.option === resolved
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        );
      }
      return [...prev, { productId, quantity: 1, option: resolved }];
    });
  }

  function removeItem(productId, option) {
    resetCoupon();
    const product = getProduct(productId);
    const resolved = product
      ? normalizeOption(product, option)
      : option || 'piece';

    setItems((prev) => {
      const existing = prev.find(
        (i) => i.productId === productId && i.option === resolved,
      );
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        const next = prev.filter(
          (i) => !(i.productId === productId && i.option === resolved),
        );
        if (next.length === 0) setBusinessId('');
        return next;
      }
      return prev.map((i) =>
        i.productId === productId && i.option === resolved
          ? { ...i, quantity: i.quantity - 1 }
          : i,
      );
    });
  }

  function getQuantity(productId, option) {
    const product = getProduct(productId);
    const resolved = product
      ? normalizeOption(product, option)
      : option || 'piece';
    return (
      items.find((i) => i.productId === productId && i.option === resolved)
        ?.quantity ?? 0
    );
  }

  function clearCart() {
    setItems([]);
    setBusinessId('');
    setCoupon(null);
    setCouponError('');
    clearStoredCart();
  }

  async function applyCoupon(code) {
    setApplyingCoupon(true);
    setCouponError('');
    try {
      const quote = await couponUseCases.validate.execute({
        code,
        restaurantId: businessId,
        subtotal,
        deliveryCharge: baseDeliveryFee,
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
    originalDeliveryFee: baseDeliveryFee,
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

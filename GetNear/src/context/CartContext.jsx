import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { deliveryFee as fallbackDeliveryFee, taxRate as fallbackTaxRate } from '../data/mockData';
import { useCatalog } from './CatalogContext';
import { couponUseCases } from '../application/container';
import { supabase } from '../lib/supabase';
import {
  clearStoredCart,
  mergeCartLines,
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
import ReplaceCartModal from '../components/ui/ReplaceCartModal';
import ActiveOrderBlockModal from '../components/ui/ActiveOrderBlockModal';
import { useAuth } from './AuthContext';
import { useActiveOrder } from '../presentation/hooks/useActiveOrder';

const CartContext = createContext(null);

function resolveStoredOption(getProduct, productId, option) {
  const product = getProduct(productId);
  if (!product) return null;
  return normalizeOption(product, option);
}

export function CartProvider({ children }) {
  const { getBusiness, getProduct, loading: catalogLoading } = useCatalog();
  const { user } = useAuth();
  const { activeOrder, hasActiveOrder, refresh: refreshActiveOrder } =
    useActiveOrder({ enabled: Boolean(user?.id) });
  const [businessId, setBusinessId] = useState(() => readStoredCart().businessId);
  const [items, setItems] = useState(() => readStoredCart().items);
  const [coupon, setCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [baseDeliveryFee, setBaseDeliveryFee] = useState(fallbackDeliveryFee);
  const [taxRate, setTaxRate] = useState(fallbackTaxRate);
  const [hydrated, setHydrated] = useState(false);
  const [replacePrompt, setReplacePrompt] = useState(null);
  const [blockPrompt, setBlockPrompt] = useState(false);

  const business = getBusiness(businessId);

  useEffect(() => {
    if (catalogLoading) return;
    setItems((prev) => {
      const next = mergeCartLines(prev, (productId, option) =>
        resolveStoredOption(getProduct, productId, option),
      );
      const same =
        next.length === prev.length &&
        next.every(
          (row, i) =>
            row.productId === String(prev[i].productId) &&
            row.quantity === prev[i].quantity &&
            row.option === prev[i].option,
        );
      if (same) return prev;
      if (next.length === 0) setBusinessId('');
      return next;
    });
    setHydrated(true);
  }, [catalogLoading, getProduct]);

  useEffect(() => {
    if (!hydrated && catalogLoading) return;
    writeStoredCart({ businessId, items });
  }, [businessId, items, hydrated, catalogLoading]);

  const cartItems = useMemo(() => {
    const merged = mergeCartLines(items, (productId, option) =>
      resolveStoredOption(getProduct, productId, option),
    );
    return merged
      .map((row) => {
        const product = getProduct(row.productId);
        if (!product) return null;
        const option = row.option;
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
      .filter(Boolean);
  }, [items, getProduct]);

  const itemCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

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

  function commitAdd(productId, option, restaurantId) {
    resetCoupon();
    const id = String(productId);
    const product = getProduct(id);
    const resolved = product ? normalizeOption(product, option) : option || 'piece';

    setBusinessId(restaurantId);
    setItems((prev) => {
      const sameStore = !businessId || businessId === restaurantId;
      if (!sameStore) {
        return [{ productId: id, quantity: 1, option: resolved }];
      }

      const base = mergeCartLines(prev, (pid, opt) =>
        resolveStoredOption(getProduct, pid, opt),
      );
      const existing = base.find(
        (i) => i.productId === id && i.option === resolved,
      );
      if (existing) {
        return base.map((i) =>
          i.productId === id && i.option === resolved
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        );
      }
      return [...base, { productId: id, quantity: 1, option: resolved }];
    });
  }

  function addItem(productId, option) {
    if (hasActiveOrder) {
      setBlockPrompt(true);
      return;
    }

    const product = getProduct(productId);
    if (!product) return;
    const id = String(productId);
    const resolved = normalizeOption(product, option);
    const hasOtherRestaurant =
      Boolean(businessId) &&
      items.length > 0 &&
      product.businessId !== businessId;

    if (hasOtherRestaurant) {
      const nextBiz = getBusiness(product.businessId);
      setReplacePrompt({
        productId: id,
        option: resolved,
        restaurantId: product.businessId,
        fromName: business?.name || 'another restaurant',
        toName: nextBiz?.name || 'this restaurant',
      });
      return;
    }

    commitAdd(id, resolved, product.businessId);
  }

  function confirmReplaceCart() {
    if (hasActiveOrder) {
      setReplacePrompt(null);
      setBlockPrompt(true);
      return;
    }
    if (!replacePrompt) return;
    const { productId, option, restaurantId } = replacePrompt;
    setReplacePrompt(null);
    resetCoupon();
    setBusinessId(restaurantId);
    setItems([{ productId, quantity: 1, option }]);
  }

  function cancelReplaceCart() {
    setReplacePrompt(null);
  }

  function dismissBlockPrompt() {
    setBlockPrompt(false);
  }

  /** Re-check server before checkout / place order. */
  async function assertCanOrder() {
    const active = await refreshActiveOrder();
    if (active) {
      setBlockPrompt(true);
      return false;
    }
    return true;
  }

  function removeItem(productId, option) {
    resetCoupon();
    const product = getProduct(productId);
    const id = String(productId);
    const resolved = product
      ? normalizeOption(product, option)
      : option || 'piece';

    setItems((prev) => {
      const base = mergeCartLines(prev, (pid, opt) =>
        resolveStoredOption(getProduct, pid, opt),
      );
      const existing = base.find(
        (i) => i.productId === id && i.option === resolved,
      );
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        const next = base.filter(
          (i) => !(i.productId === id && i.option === resolved),
        );
        if (next.length === 0) setBusinessId('');
        return next;
      }
      return base.map((i) =>
        i.productId === id && i.option === resolved
          ? { ...i, quantity: i.quantity - 1 }
          : i,
      );
    });
  }

  function getQuantity(productId, option) {
    const product = getProduct(productId);
    const id = String(productId);
    const resolved = product
      ? normalizeOption(product, option)
      : option || 'piece';
    return items.reduce((sum, row) => {
      if (String(row.productId) !== id) return sum;
      const rowProduct = getProduct(row.productId);
      const rowOption = rowProduct
        ? normalizeOption(rowProduct, row.option)
        : row.option;
      return rowOption === resolved ? sum + row.quantity : sum;
    }, 0);
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
    hasActiveOrder,
    activeOrder,
    assertCanOrder,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
      <ReplaceCartModal
        open={Boolean(replacePrompt)}
        fromName={replacePrompt?.fromName}
        toName={replacePrompt?.toName}
        onCancel={cancelReplaceCart}
        onReplace={confirmReplaceCart}
      />
      <ActiveOrderBlockModal
        open={blockPrompt}
        order={activeOrder}
        onClose={dismissBlockPrompt}
      />
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

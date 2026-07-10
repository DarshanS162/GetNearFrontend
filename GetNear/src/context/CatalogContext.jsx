import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  businesses as seedBusinesses,
  menuCategories as seedMenuCategories,
  products as seedProducts,
} from '../data/mockData';

const STORAGE_KEY = 'getnear-catalog-v2';

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function loadCatalog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* use seed */
  }
  return {
    businesses: seedBusinesses,
    menuCategories: seedMenuCategories,
    products: seedProducts,
  };
}

const CatalogContext = createContext(null);

export function CatalogProvider({ children }) {
  const [catalog, setCatalog] = useState(loadCatalog);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
  }, [catalog]);

  const businesses = catalog.businesses;
  const menuCategories = catalog.menuCategories;
  const products = catalog.products;

  function getBusiness(id) {
    return businesses.find((b) => b.id === id);
  }

  function getProduct(id) {
    return products.find((p) => p.id === id);
  }

  function getBusinessProducts(businessId, categoryId) {
    return products.filter(
      (p) =>
        p.businessId === businessId &&
        (!categoryId || p.categoryId === categoryId),
    );
  }

  function getMenuCategoriesForBusiness(businessId) {
    const usedIds = new Set(
      products.filter((p) => p.businessId === businessId).map((p) => p.categoryId),
    );
    return menuCategories.filter((c) => usedIds.has(c.id));
  }

  const trendingDishes = useMemo(
    () =>
      products.slice(0, 3).map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        emoji: '🍽️',
      })),
    [products],
  );

  function addRestaurant(data) {
    const id = slugify(data.name) || `restaurant-${Date.now()}`;
    const restaurant = {
      id,
      name: data.name,
      slug: data.slug || slugify(data.name),
      type: data.type || '',
      location: data.location || '',
      description: data.description || '',
      contactPhone: data.contactPhone || '',
      contactEmail: data.contactEmail || '',
      gstNumber: data.gstNumber || '',
      fssaiNumber: data.fssaiNumber || '',
      ownerPhone: data.ownerPhone || '',
      ownerName: data.ownerName || '',
      businessStatus: data.businessStatus || 'active',
      rating: 4.0,
      reviews: 0,
      deliveryTime: Number(data.deliveryTime) || 30,
      freeDeliveryAbove: Number(data.freeDeliveryAbove) || 299,
      isOpen: data.businessStatus !== 'inactive',
      bannerColor: data.bannerColor || '#FFF0E8',
      icon: data.icon || '🍽️',
      category: data.category || 'food',
      offer: data.offer || '',
    };

    setCatalog((prev) => ({
      ...prev,
      businesses: [...prev.businesses, restaurant],
    }));

    return restaurant;
  }

  function deleteRestaurant(id) {
    setCatalog((prev) => ({
      businesses: prev.businesses.filter((b) => b.id !== id),
      menuCategories: prev.menuCategories,
      products: prev.products.filter((p) => p.businessId !== id),
    }));
  }

  function addMenuCategory(name) {
    const id = slugify(name) || `cat-${Date.now()}`;
    const category = { id, name };

    setCatalog((prev) => {
      if (prev.menuCategories.some((c) => c.id === id)) return prev;
      return {
        ...prev,
        menuCategories: [...prev.menuCategories, category],
      };
    });

    return category;
  }

  function addProduct(data) {
    setCatalog((prev) => {
      let categoryId = data.categoryId;
      let nextCategories = prev.menuCategories;

      if (data.newCategoryName?.trim()) {
        const catId = slugify(data.newCategoryName.trim()) || `cat-${Date.now()}`;
        if (!nextCategories.some((c) => c.id === catId)) {
          nextCategories = [
            ...nextCategories,
            { id: catId, name: data.newCategoryName.trim() },
          ];
        }
        categoryId = catId;
      }

      const id = slugify(data.name) || `product-${Date.now()}`;
      const product = {
        id,
        businessId: data.businessId,
        categoryId,
        name: data.name,
        description: data.description || '',
        price: Number(data.price),
        mrp: Number(data.mrp) || Number(data.price),
        foodType: data.foodType || 'veg',
        prepTime: Number(data.prepTime) || 15,
        ingredients: data.ingredients || '',
        isAvailable: data.isAvailable !== false,
      };

      return {
        ...prev,
        menuCategories: nextCategories,
        products: [...prev.products, product],
      };
    });
  }

  function deleteProduct(id) {
    setCatalog((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== id),
    }));
  }

  function getBusinessByOwnerPhone(phone) {
    const normalized = String(phone || '').replace(/\D/g, '').slice(-10);
    return businesses.find(
      (b) => String(b.ownerPhone || '').replace(/\D/g, '').slice(-10) === normalized,
    );
  }

  function resetCatalog() {
    const seed = {
      businesses: seedBusinesses,
      menuCategories: seedMenuCategories,
      products: seedProducts,
    };
    setCatalog(seed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  }

  const value = {
    businesses,
    menuCategories,
    products,
    trendingDishes,
    getBusiness,
    getProduct,
    getBusinessProducts,
    getMenuCategoriesForBusiness,
    getBusinessByOwnerPhone,
    addRestaurant,
    deleteRestaurant,
    addMenuCategory,
    addProduct,
    deleteProduct,
    resetCatalog,
    slugify,
  };

  return (
    <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
  );
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used within CatalogProvider');
  return ctx;
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  mapCategory,
  mapProduct,
  mapRestaurant,
  normalizePhone,
  slugify,
} from '../lib/utils';

const CatalogContext = createContext(null);

export function CatalogProvider({ children }) {
  const [businesses, setBusinesses] = useState([]);
  const [menuCategories, setMenuCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshCatalog = useCallback(async () => {
    setError('');
    try {
      const [restRes, catRes, prodRes] = await Promise.all([
        supabase
          .from('restaurants')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('categories')
          .select('*')
          .is('deleted_at', null)
          .order('display_order', { ascending: true }),
        supabase
          .from('products')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
      ]);

      if (restRes.error) throw restRes.error;
      if (catRes.error) throw catRes.error;
      if (prodRes.error) throw prodRes.error;

      const ownerIds = [...new Set((restRes.data || []).map((r) => r.owner_id).filter(Boolean))];
      let ownersById = {};

      if (ownerIds.length > 0) {
        const { data: owners, error: ownersError } = await supabase
          .from('users')
          .select('id, full_name, phone')
          .in('id', ownerIds)
          .is('deleted_at', null);

        // Owners may be hidden by RLS for anonymous users — ignore then
        if (!ownersError && owners) {
          ownersById = Object.fromEntries(owners.map((o) => [o.id, o]));
        }
      }

      setBusinesses(
        (restRes.data || []).map((row) => mapRestaurant(row, ownersById[row.owner_id])),
      );
      setMenuCategories((catRes.data || []).map(mapCategory));
      setProducts((prodRes.data || []).map(mapProduct));
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load catalog');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCatalog();
  }, [refreshCatalog]);

  const getBusiness = useCallback(
    (id) => businesses.find((b) => b.id === id),
    [businesses],
  );

  const getProduct = useCallback(
    (id) => products.find((p) => p.id === id),
    [products],
  );

  function getBusinessProducts(businessId, categoryId) {
    return products.filter(
      (p) =>
        p.businessId === businessId &&
        (!categoryId || p.categoryId === categoryId),
    );
  }

  function getMenuCategoriesForBusiness(businessId) {
    return menuCategories.filter((c) => c.restaurantId === businessId);
  }

  const trendingDishes = useMemo(
    () =>
      products
        .filter((p) => p.isAvailable)
        .slice(0, 3)
        .map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          emoji: '🍽️',
        })),
    [products],
  );

  async function ensureOwnerUser({ ownerName, ownerPhone }) {
    const digits = normalizePhone(ownerPhone);
    if (digits.length !== 10) throw new Error('Owner phone must be 10 digits');

    const { data: role } = await supabase
      .from('roles')
      .select('id')
      .eq('slug', 'restaurant_owner')
      .is('deleted_at', null)
      .single();

    if (!role?.id) throw new Error('restaurant_owner role missing — run migrations');

    const { data: existing } = await supabase
      .from('users')
      .select('id, full_name, phone')
      .is('deleted_at', null);

    const match = (existing || []).find(
      (u) => normalizePhone(u.phone) === digits,
    );

    if (match) {
      await supabase
        .from('users')
        .update({
          full_name: ownerName || match.full_name,
          role_id: role.id,
        })
        .eq('id', match.id);
      return match.id;
    }

    const { data: created, error } = await supabase
      .from('users')
      .insert({
        auth_user_uuid: crypto.randomUUID(),
        role_id: role.id,
        full_name: ownerName,
        phone: digits,
        is_active: true,
      })
      .select('id')
      .single();

    if (error) throw error;
    return created.id;
  }

  async function addRestaurant(data) {
    const baseSlug = slugify(data.name) || `restaurant-${Date.now()}`;
    let slug = baseSlug;
    let attempt = 1;

    const ownerId = await ensureOwnerUser({
      ownerName: data.ownerName,
      ownerPhone: data.ownerPhone,
    });

    // Ensure unique slug
    while (attempt < 20) {
      const payload = {
        name: data.name.trim(),
        slug,
        description: data.description || null,
        cuisine_type: data.type || null,
        location_label: data.location || null,
        contact_phone: data.contactPhone || null,
        contact_email: data.contactEmail || null,
        gst_number: data.gstNumber || null,
        fssai_number: data.fssaiNumber || null,
        business_status: data.businessStatus || 'active',
        is_active: (data.businessStatus || 'active') === 'active',
        delivery_time_minutes: Number(data.deliveryTime) || 30,
        free_delivery_above: Number(data.freeDeliveryAbove) || 299,
        banner_color: data.bannerColor || '#FFF0E8',
        icon_emoji: data.icon || '🍽️',
        offer_badge: data.offer || null,
        category_slug: data.category || 'food',
        owner_id: ownerId,
      };

      const { data: row, error } = await supabase
        .from('restaurants')
        .insert(payload)
        .select('*')
        .single();

      if (!error) {
        await refreshCatalog();
        return mapRestaurant(row, {
          full_name: data.ownerName,
          phone: normalizePhone(data.ownerPhone),
        });
      }

      if (error.message?.includes('idx_restaurants_slug') || error.code === '23505') {
        attempt += 1;
        slug = `${baseSlug}-${attempt}`;
        continue;
      }
      throw error;
    }

    throw new Error('Could not create unique restaurant slug');
  }

  async function deleteRestaurant(id) {
    const { error } = await supabase
      .from('restaurants')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id);

    if (error) throw error;
    await refreshCatalog();
  }

  async function addProduct(data) {
    let categoryId = data.categoryId;

    if (data.newCategoryName?.trim()) {
      const catSlug = slugify(data.newCategoryName) || `cat-${Date.now()}`;
      const { data: cat, error: catError } = await supabase
        .from('categories')
        .insert({
          restaurant_id: data.businessId,
          name: data.newCategoryName.trim(),
          slug: catSlug,
          display_order: 0,
          is_active: true,
        })
        .select('*')
        .single();

      if (catError) throw catError;
      categoryId = cat.id;
    }

    if (!categoryId) throw new Error('Category is required');

    const price = Number(data.price);
    const mrp = Number(data.mrp) || price;
    if (mrp < price) throw new Error('MRP must be greater than or equal to selling price');

    const baseSlug = slugify(data.name) || `product-${Date.now()}`;
    let slug = baseSlug;
    let attempt = 1;

    while (attempt < 20) {
      const { error } = await supabase.from('products').insert({
        restaurant_id: data.businessId,
        category_id: categoryId,
        name: data.name.trim(),
        slug,
        description: data.description || null,
        food_type: data.foodType || 'veg',
        mrp,
        selling_price: price,
        discount_amount: Math.max(0, mrp - price),
        preparation_time_minutes: Number(data.prepTime) || 15,
        is_available: data.isAvailable !== false,
        ingredients: data.ingredients || null,
      });

      if (!error) {
        await refreshCatalog();
        return;
      }

      if (error.code === '23505') {
        attempt += 1;
        slug = `${baseSlug}-${attempt}`;
        continue;
      }
      throw error;
    }

    throw new Error('Could not create product');
  }

  async function deleteProduct(id) {
    const { error } = await supabase
      .from('products')
      .update({ deleted_at: new Date().toISOString(), is_available: false })
      .eq('id', id);

    if (error) throw error;
    await refreshCatalog();
  }

  function getBusinessByOwnerPhone(phone) {
    const normalized = normalizePhone(phone);
    return businesses.find((b) => normalizePhone(b.ownerPhone) === normalized);
  }

  const value = {
    businesses,
    menuCategories,
    products,
    trendingDishes,
    loading,
    error,
    refreshCatalog,
    getBusiness,
    getProduct,
    getBusinessProducts,
    getMenuCategoriesForBusiness,
    getBusinessByOwnerPhone,
    addRestaurant,
    deleteRestaurant,
    addProduct,
    deleteProduct,
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

-- ============================================================================
-- Migration: 025_restaurant_display_fields_and_rls
-- Purpose:
--   1. Add UI display fields used by GetNear frontend
--   2. Add ingredients on products
--   3. Enable RLS with public read + admin/owner write policies
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Restaurant display / ops fields (customer + admin UI)
-- ---------------------------------------------------------------------------
ALTER TABLE public.restaurants
    ADD COLUMN IF NOT EXISTS cuisine_type VARCHAR(200),
    ADD COLUMN IF NOT EXISTS location_label VARCHAR(200),
    ADD COLUMN IF NOT EXISTS delivery_time_minutes INTEGER NOT NULL DEFAULT 30,
    ADD COLUMN IF NOT EXISTS free_delivery_above DECIMAL(10, 2) NOT NULL DEFAULT 299,
    ADD COLUMN IF NOT EXISTS banner_color VARCHAR(20) NOT NULL DEFAULT '#FFF0E8',
    ADD COLUMN IF NOT EXISTS icon_emoji VARCHAR(16) NOT NULL DEFAULT '🍽️',
    ADD COLUMN IF NOT EXISTS offer_badge VARCHAR(50),
    ADD COLUMN IF NOT EXISTS category_slug VARCHAR(50) NOT NULL DEFAULT 'food';

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS ingredients TEXT;

COMMENT ON COLUMN public.restaurants.cuisine_type IS 'Cuisine tags shown on customer cards (e.g. North Indian, thali).';
COMMENT ON COLUMN public.restaurants.location_label IS 'Human-readable area label (e.g. Andheri West).';
COMMENT ON COLUMN public.products.ingredients IS 'Optional ingredients text for product detail page.';

-- ---------------------------------------------------------------------------
-- Auth helpers (SECURITY DEFINER so RLS can resolve role safely)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.id
    FROM public.users u
    WHERE u.auth_user_uuid = auth.uid()
      AND u.deleted_at IS NULL
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_role_slug()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT r.slug
    FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
    WHERE u.auth_user_uuid = auth.uid()
      AND u.deleted_at IS NULL
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(public.current_role_slug() IN ('admin', 'super_admin'), FALSE);
$$;

CREATE OR REPLACE FUNCTION public.is_restaurant_owner_of(p_restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.restaurants rest
        WHERE rest.id = p_restaurant_id
          AND rest.owner_id = public.current_app_user_id()
          AND rest.deleted_at IS NULL
    );
$$;

-- ---------------------------------------------------------------------------
-- RLS: roles (read-only for authenticated)
-- ---------------------------------------------------------------------------
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS roles_select_all ON public.roles;
CREATE POLICY roles_select_all ON public.roles
    FOR SELECT USING (TRUE);

-- ---------------------------------------------------------------------------
-- RLS: users
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_own_or_admin ON public.users;
CREATE POLICY users_select_own_or_admin ON public.users
    FOR SELECT USING (
        auth_user_uuid = auth.uid()
        OR public.is_admin()
    );

DROP POLICY IF EXISTS users_insert_admin ON public.users;
CREATE POLICY users_insert_admin ON public.users
    FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS users_update_own_or_admin ON public.users;
CREATE POLICY users_update_own_or_admin ON public.users
    FOR UPDATE USING (
        auth_user_uuid = auth.uid()
        OR public.is_admin()
    );

-- Profile linking on first login uses SECURITY DEFINER RPCs (claim_user_by_phone).
-- Do NOT add an open UPDATE policy with USING (TRUE).

-- ---------------------------------------------------------------------------
-- RLS: restaurants — public read active; admin write; owner limited update
-- ---------------------------------------------------------------------------
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS restaurants_select_public ON public.restaurants;
CREATE POLICY restaurants_select_public ON public.restaurants
    FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS restaurants_insert_admin ON public.restaurants;
CREATE POLICY restaurants_insert_admin ON public.restaurants
    FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS restaurants_update_admin_or_owner ON public.restaurants;
CREATE POLICY restaurants_update_admin_or_owner ON public.restaurants
    FOR UPDATE USING (
        public.is_admin()
        OR public.is_restaurant_owner_of(id)
    );

DROP POLICY IF EXISTS restaurants_delete_admin ON public.restaurants;
CREATE POLICY restaurants_delete_admin ON public.restaurants
    FOR UPDATE USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- RLS: categories
-- ---------------------------------------------------------------------------
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS categories_select_public ON public.categories;
CREATE POLICY categories_select_public ON public.categories
    FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS categories_write_admin_or_owner ON public.categories;
CREATE POLICY categories_write_admin_or_owner ON public.categories
    FOR ALL USING (
        public.is_admin()
        OR public.is_restaurant_owner_of(restaurant_id)
    )
    WITH CHECK (
        public.is_admin()
        OR public.is_restaurant_owner_of(restaurant_id)
    );

-- ---------------------------------------------------------------------------
-- RLS: products
-- ---------------------------------------------------------------------------
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_select_public ON public.products;
CREATE POLICY products_select_public ON public.products
    FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS products_write_admin_or_owner ON public.products;
CREATE POLICY products_write_admin_or_owner ON public.products
    FOR ALL USING (
        public.is_admin()
        OR public.is_restaurant_owner_of(restaurant_id)
    )
    WITH CHECK (
        public.is_admin()
        OR public.is_restaurant_owner_of(restaurant_id)
    );

-- Soft-delete friendly: allow authenticated admin soft updates already covered above

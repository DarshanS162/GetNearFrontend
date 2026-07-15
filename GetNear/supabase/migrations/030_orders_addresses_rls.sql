-- ============================================================================
-- Migration: 030_orders_addresses_rls
-- Purpose: RLS for addresses, branches, orders, order_items, payments (Phase 1)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- restaurant_branches
-- ---------------------------------------------------------------------------
ALTER TABLE public.restaurant_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS branches_select_public ON public.restaurant_branches;
CREATE POLICY branches_select_public ON public.restaurant_branches
    FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS branches_write_admin_or_owner ON public.restaurant_branches;
CREATE POLICY branches_write_admin_or_owner ON public.restaurant_branches
    FOR ALL USING (
        public.is_admin()
        OR public.is_restaurant_owner_of(restaurant_id)
    )
    WITH CHECK (
        public.is_admin()
        OR public.is_restaurant_owner_of(restaurant_id)
    );

-- Bootstrap a main branch for checkout when none exists (bypasses RLS safely).
CREATE OR REPLACE FUNCTION public.ensure_main_branch(p_restaurant_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_branch_id UUID;
    v_rest RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT id, name, location_label, contact_phone
      INTO v_rest
      FROM public.restaurants
     WHERE id = p_restaurant_id
       AND deleted_at IS NULL;

    IF v_rest.id IS NULL THEN
        RAISE EXCEPTION 'Restaurant not found';
    END IF;

    SELECT b.id INTO v_branch_id
      FROM public.restaurant_branches b
     WHERE b.restaurant_id = p_restaurant_id
       AND b.deleted_at IS NULL
       AND b.is_active = TRUE
     ORDER BY b.is_main_branch DESC, b.created_at ASC
     LIMIT 1;

    IF v_branch_id IS NOT NULL THEN
        RETURN v_branch_id;
    END IF;

    INSERT INTO public.restaurant_branches (
        restaurant_id,
        name,
        address_line1,
        city,
        state,
        pincode,
        latitude,
        longitude,
        phone,
        is_main_branch,
        is_active
    ) VALUES (
        p_restaurant_id,
        COALESCE(NULLIF(trim(v_rest.name), ''), 'Main branch') || ' - Main',
        COALESCE(NULLIF(trim(v_rest.location_label), ''), 'Local area'),
        'Mumbai',
        'Maharashtra',
        '400001',
        19.0760,
        72.8777,
        v_rest.contact_phone,
        TRUE,
        TRUE
    )
    RETURNING id INTO v_branch_id;

    RETURN v_branch_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_main_branch(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- addresses
-- ---------------------------------------------------------------------------
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS addresses_select_own ON public.addresses;
CREATE POLICY addresses_select_own ON public.addresses
    FOR SELECT USING (
        public.is_admin()
        OR user_id = public.current_app_user_id()
        OR EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.address_id = addresses.id
              AND (
                  o.customer_id = public.current_app_user_id()
                  OR public.is_restaurant_owner_of(o.restaurant_id)
              )
        )
    );

DROP POLICY IF EXISTS addresses_insert_own ON public.addresses;
CREATE POLICY addresses_insert_own ON public.addresses
    FOR INSERT WITH CHECK (
        user_id = public.current_app_user_id()
        OR public.is_admin()
    );

DROP POLICY IF EXISTS addresses_update_own ON public.addresses;
CREATE POLICY addresses_update_own ON public.addresses
    FOR UPDATE USING (
        user_id = public.current_app_user_id()
        OR public.is_admin()
    )
    WITH CHECK (
        user_id = public.current_app_user_id()
        OR public.is_admin()
    );

DROP POLICY IF EXISTS addresses_delete_own ON public.addresses;
CREATE POLICY addresses_delete_own ON public.addresses
    FOR DELETE USING (
        user_id = public.current_app_user_id()
        OR public.is_admin()
    );

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_select_customer_owner_admin ON public.orders;
CREATE POLICY orders_select_customer_owner_admin ON public.orders
    FOR SELECT USING (
        public.is_admin()
        OR customer_id = public.current_app_user_id()
        OR public.is_restaurant_owner_of(restaurant_id)
    );

DROP POLICY IF EXISTS orders_insert_customer ON public.orders;
CREATE POLICY orders_insert_customer ON public.orders
    FOR INSERT WITH CHECK (
        customer_id = public.current_app_user_id()
        OR public.is_admin()
    );

DROP POLICY IF EXISTS orders_update_owner_admin ON public.orders;
CREATE POLICY orders_update_owner_admin ON public.orders
    FOR UPDATE USING (
        public.is_admin()
        OR public.is_restaurant_owner_of(restaurant_id)
        OR (
            customer_id = public.current_app_user_id()
            AND order_status IN ('placed', 'confirmed')
        )
    )
    WITH CHECK (
        public.is_admin()
        OR public.is_restaurant_owner_of(restaurant_id)
        OR customer_id = public.current_app_user_id()
    );

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_items_select_related ON public.order_items;
CREATE POLICY order_items_select_related ON public.order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
              AND (
                  public.is_admin()
                  OR o.customer_id = public.current_app_user_id()
                  OR public.is_restaurant_owner_of(o.restaurant_id)
              )
        )
    );

DROP POLICY IF EXISTS order_items_insert_customer ON public.order_items;
CREATE POLICY order_items_insert_customer ON public.order_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
              AND (
                  o.customer_id = public.current_app_user_id()
                  OR public.is_admin()
              )
        )
    );

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_select_related ON public.payments;
CREATE POLICY payments_select_related ON public.payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = payments.order_id
              AND (
                  public.is_admin()
                  OR o.customer_id = public.current_app_user_id()
                  OR public.is_restaurant_owner_of(o.restaurant_id)
              )
        )
    );

DROP POLICY IF EXISTS payments_insert_customer ON public.payments;
CREATE POLICY payments_insert_customer ON public.payments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = payments.order_id
              AND (
                  o.customer_id = public.current_app_user_id()
                  OR public.is_admin()
              )
        )
    );

DROP POLICY IF EXISTS payments_update_admin_owner ON public.payments;
CREATE POLICY payments_update_admin_owner ON public.payments
    FOR UPDATE USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = payments.order_id
              AND public.is_restaurant_owner_of(o.restaurant_id)
        )
    );

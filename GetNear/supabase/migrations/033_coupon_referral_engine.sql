-- ============================================================================
-- Migration 033: Generic multi-tenant coupon + referral engine
-- ============================================================================

-- Extend the original restaurant-only coupon table without duplicating engines.
ALTER TABLE public.coupons
    ALTER COLUMN restaurant_id DROP NOT NULL;

ALTER TABLE public.coupons
    ADD COLUMN IF NOT EXISTS owner_type VARCHAR(20) NOT NULL DEFAULT 'business',
    ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'order',
    ADD COLUMN IF NOT EXISTS audience VARCHAR(20) NOT NULL DEFAULT 'all',
    ADD COLUMN IF NOT EXISTS first_order_only BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_reward_only BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS buy_quantity INTEGER,
    ADD COLUMN IF NOT EXISTS get_quantity INTEGER,
    ADD COLUMN IF NOT EXISTS rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS created_by UUID;

ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_discount_type_check;
ALTER TABLE public.coupons ADD CONSTRAINT coupons_discount_type_check
    CHECK (discount_type IN ('percentage', 'flat', 'free_delivery', 'buy_x_get_y'));

ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_discount_value_positive;
ALTER TABLE public.coupons ADD CONSTRAINT coupons_discount_value_positive
    CHECK (
        (discount_type IN ('percentage', 'flat') AND discount_value > 0)
        OR (discount_type IN ('free_delivery', 'buy_x_get_y') AND discount_value >= 0)
    );

ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_percentage_max;
ALTER TABLE public.coupons ADD CONSTRAINT coupons_percentage_max
    CHECK (discount_type <> 'percentage' OR discount_value <= 100);

ALTER TABLE public.coupons
    ADD CONSTRAINT coupons_owner_type_check
        CHECK (owner_type IN ('platform', 'business')),
    ADD CONSTRAINT coupons_scope_check
        CHECK (scope IN ('platform', 'business', 'order', 'category', 'product')),
    ADD CONSTRAINT coupons_audience_check
        CHECK (audience IN ('all', 'new_users', 'existing_users')),
    ADD CONSTRAINT coupons_owner_consistency_check
        CHECK (
            (owner_type = 'platform')
            OR (owner_type = 'business' AND restaurant_id IS NOT NULL)
        ),
    ADD CONSTRAINT coupons_buy_get_check
        CHECK (
            discount_type <> 'buy_x_get_y'
            OR (buy_quantity IS NOT NULL AND buy_quantity > 0
                AND get_quantity IS NOT NULL AND get_quantity > 0)
        );

ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS fk_coupons_created_by;
ALTER TABLE public.coupons ADD CONSTRAINT fk_coupons_created_by
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_platform_code_active
    ON public.coupons(upper(code))
    WHERE owner_type = 'platform' AND deleted_at IS NULL;

-- A platform coupon may be limited to selected businesses. No rows means all.
CREATE TABLE IF NOT EXISTS public.coupon_businesses (
    coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    PRIMARY KEY (coupon_id, restaurant_id)
);

CREATE TABLE IF NOT EXISTS public.coupon_categories (
    coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    PRIMARY KEY (coupon_id, category_id)
);

CREATE TABLE IF NOT EXISTS public.coupon_products (
    coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    PRIMARY KEY (coupon_id, product_id)
);

-- Reward-only coupons are made available through grants.
CREATE TABLE IF NOT EXISTS public.coupon_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    source_type VARCHAR(30) NOT NULL DEFAULT 'manual',
    source_id UUID,
    expires_at TIMESTAMPTZ,
    redeemed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (coupon_id, user_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_coupon_grants_user
    ON public.coupon_grants(user_id, redeemed_at);

-- Referral identity is permanent and unique per application user.
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS referral_code VARCHAR(16),
    ADD COLUMN IF NOT EXISTS referred_by_user_id UUID;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS fk_users_referred_by;
ALTER TABLE public.users ADD CONSTRAINT fk_users_referred_by
    FOREIGN KEY (referred_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code
    ON public.users(upper(referral_code))
    WHERE referral_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_code TEXT;
BEGIN
    IF NEW.referral_code IS NOT NULL AND trim(NEW.referral_code) <> '' THEN
        NEW.referral_code := upper(trim(NEW.referral_code));
        RETURN NEW;
    END IF;

    LOOP
        v_code := 'GN' || upper(substr(md5(NEW.id::text || clock_timestamp()::text), 1, 8));
        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM public.users WHERE upper(referral_code) = v_code
        );
    END LOOP;
    NEW.referral_code := v_code;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_referral_code ON public.users;
CREATE TRIGGER trg_users_referral_code
    BEFORE INSERT OR UPDATE OF referral_code ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.generate_referral_code();

UPDATE public.users
SET referral_code = NULL
WHERE referral_code IS NULL;

CREATE TABLE IF NOT EXISTS public.referral_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    referrer_coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
    referred_coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
    reward_type VARCHAR(20) NOT NULL DEFAULT 'coupon',
    reward_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT referral_campaign_reward_type_check
        CHECK (reward_type IN ('coupon', 'wallet', 'points')),
    CONSTRAINT referral_campaign_validity_check
        CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.referral_campaigns(id) ON DELETE RESTRICT,
    referrer_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    referred_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    referral_code VARCHAR(16) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'first_order_pending',
    qualifying_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rewarded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT referrals_no_self_referral CHECK (referrer_user_id <> referred_user_id),
    CONSTRAINT referrals_status_check
        CHECK (status IN ('registered', 'first_order_pending', 'reward_issued', 'disabled')),
    UNIQUE (referred_user_id)
);

CREATE TABLE IF NOT EXISTS public.referral_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_id UUID NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
    beneficiary_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    beneficiary_type VARCHAR(20) NOT NULL,
    reward_type VARCHAR(20) NOT NULL,
    coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
    reward_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'issued',
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT referral_reward_beneficiary_check
        CHECK (beneficiary_type IN ('referrer', 'referred')),
    CONSTRAINT referral_reward_type_check
        CHECK (reward_type IN ('coupon', 'wallet', 'points')),
    UNIQUE (referral_id, beneficiary_type)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_beneficiary
    ON public.referral_rewards(beneficiary_user_id);

DROP TRIGGER IF EXISTS trg_referral_campaigns_updated_at ON public.referral_campaigns;
CREATE TRIGGER trg_referral_campaigns_updated_at
    BEFORE UPDATE ON public.referral_campaigns
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Coupon calculation. The client receives a quote; redemption revalidates.
-- p_items: [{ productId, quantity, unitPrice }]
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_coupon(
    p_code TEXT,
    p_restaurant_id UUID,
    p_items JSONB,
    p_subtotal NUMERIC,
    p_delivery_charge NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_coupon public.coupons%ROWTYPE;
    v_user_id UUID;
    v_successful_orders INTEGER := 0;
    v_user_usage INTEGER := 0;
    v_eligible_subtotal NUMERIC := 0;
    v_discount NUMERIC := 0;
    v_delivery_discount NUMERIC := 0;
    v_item JSONB;
    v_product_id UUID;
    v_product RECORD;
    v_quantity INTEGER;
    v_unit_price NUMERIC;
    v_has_business_targets BOOLEAN;
BEGIN
    v_user_id := public.current_app_user_id();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'message', 'Login required to use a coupon');
    END IF;

    SELECT * INTO v_coupon
    FROM public.coupons
    WHERE upper(code) = upper(trim(p_code))
      AND deleted_at IS NULL
      AND (restaurant_id = p_restaurant_id OR owner_type = 'platform')
    ORDER BY CASE WHEN restaurant_id = p_restaurant_id THEN 0 ELSE 1 END, created_at DESC
    LIMIT 1;

    IF v_coupon.id IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'message', 'Invalid coupon code');
    END IF;

    IF NOT v_coupon.is_active THEN
        RETURN jsonb_build_object('valid', false, 'message', 'This coupon is inactive');
    END IF;
    IF NOW() < v_coupon.valid_from OR
       (v_coupon.valid_until IS NOT NULL AND NOW() > v_coupon.valid_until) THEN
        RETURN jsonb_build_object('valid', false, 'message', 'This coupon has expired');
    END IF;
    IF v_coupon.usage_limit IS NOT NULL AND v_coupon.usage_count >= v_coupon.usage_limit THEN
        RETURN jsonb_build_object('valid', false, 'message', 'This coupon has reached its limit');
    END IF;
    IF p_subtotal < v_coupon.min_order_amount THEN
        RETURN jsonb_build_object(
            'valid', false,
            'message', 'Minimum order value is ₹' || trim(to_char(v_coupon.min_order_amount, 'FM999999990.00'))
        );
    END IF;

    IF v_coupon.owner_type = 'business' AND v_coupon.restaurant_id <> p_restaurant_id THEN
        RETURN jsonb_build_object('valid', false, 'message', 'Coupon is not valid for this business');
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.coupon_businesses WHERE coupon_id = v_coupon.id
    ) INTO v_has_business_targets;
    IF v_has_business_targets AND NOT EXISTS (
        SELECT 1 FROM public.coupon_businesses
        WHERE coupon_id = v_coupon.id AND restaurant_id = p_restaurant_id
    ) THEN
        RETURN jsonb_build_object('valid', false, 'message', 'Coupon is not valid for this business');
    END IF;

    IF v_coupon.is_reward_only AND NOT EXISTS (
        SELECT 1 FROM public.coupon_grants
        WHERE coupon_id = v_coupon.id
          AND user_id = v_user_id
          AND redeemed_at IS NULL
          AND (expires_at IS NULL OR expires_at > NOW())
    ) THEN
        RETURN jsonb_build_object('valid', false, 'message', 'This reward is not available to your account');
    END IF;

    SELECT count(*) INTO v_successful_orders
    FROM public.orders
    WHERE customer_id = v_user_id
      AND order_status = 'delivered'
      AND deleted_at IS NULL;

    IF (v_coupon.first_order_only OR v_coupon.audience = 'new_users')
       AND v_successful_orders > 0 THEN
        RETURN jsonb_build_object('valid', false, 'message', 'Valid on your first order only');
    END IF;
    IF v_coupon.audience = 'existing_users' AND v_successful_orders = 0 THEN
        RETURN jsonb_build_object('valid', false, 'message', 'Valid for existing customers only');
    END IF;

    SELECT count(*) INTO v_user_usage
    FROM public.coupon_usages
    WHERE coupon_id = v_coupon.id AND user_id = v_user_id;
    IF v_user_usage >= v_coupon.per_user_limit THEN
        RETURN jsonb_build_object('valid', false, 'message', 'You have already used this coupon');
    END IF;

    IF v_coupon.scope IN ('platform', 'business', 'order') THEN
        v_eligible_subtotal := p_subtotal;
    ELSE
        FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
        LOOP
            BEGIN
                v_product_id := (v_item->>'productId')::UUID;
            EXCEPTION WHEN invalid_text_representation THEN
                CONTINUE;
            END;
            v_quantity := GREATEST(COALESCE((v_item->>'quantity')::INTEGER, 0), 0);
            v_unit_price := GREATEST(COALESCE((v_item->>'unitPrice')::NUMERIC, 0), 0);

            SELECT id, category_id, restaurant_id INTO v_product
            FROM public.products
            WHERE id = v_product_id AND deleted_at IS NULL;

            IF v_product.id IS NOT NULL
               AND v_product.restaurant_id = p_restaurant_id
               AND (
                   (v_coupon.scope = 'product' AND EXISTS (
                       SELECT 1 FROM public.coupon_products
                       WHERE coupon_id = v_coupon.id AND product_id = v_product.id
                   ))
                   OR
                   (v_coupon.scope = 'category' AND EXISTS (
                       SELECT 1 FROM public.coupon_categories
                       WHERE coupon_id = v_coupon.id AND category_id = v_product.category_id
                   ))
               ) THEN
                v_eligible_subtotal := v_eligible_subtotal + (v_quantity * v_unit_price);
            END IF;
        END LOOP;
    END IF;

    IF v_coupon.discount_type <> 'free_delivery' AND v_eligible_subtotal <= 0 THEN
        RETURN jsonb_build_object('valid', false, 'message', 'No eligible items in your cart');
    END IF;

    CASE v_coupon.discount_type
        WHEN 'percentage' THEN
            v_discount := round(v_eligible_subtotal * v_coupon.discount_value / 100, 2);
        WHEN 'flat' THEN
            v_discount := LEAST(v_coupon.discount_value, v_eligible_subtotal);
        WHEN 'free_delivery' THEN
            v_delivery_discount := GREATEST(p_delivery_charge, 0);
        WHEN 'buy_x_get_y' THEN
            -- Schema and target model are future-ready. Checkout activation is explicit.
            RETURN jsonb_build_object('valid', false, 'message', 'Buy X Get Y is not enabled yet');
    END CASE;

    IF v_coupon.max_discount_amount IS NOT NULL THEN
        v_discount := LEAST(v_discount, v_coupon.max_discount_amount);
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'couponId', v_coupon.id,
        'code', v_coupon.code,
        'title', COALESCE(v_coupon.title, v_coupon.code),
        'discountType', v_coupon.discount_type,
        'discountAmount', v_discount,
        'deliveryDiscount', v_delivery_discount,
        'totalSavings', v_discount + v_delivery_discount,
        'message', 'Coupon applied'
    );
END;
$$;

-- Revalidates against persisted order items and records one immutable redemption.
CREATE OR REPLACE FUNCTION public.redeem_coupon_for_order(
    p_order_id UUID,
    p_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_quote JSONB;
    v_items JSONB;
    v_coupon_id UUID;
    v_discount NUMERIC;
    v_delivery_discount NUMERIC;
    v_user_id UUID;
BEGIN
    v_user_id := public.current_app_user_id();

    SELECT * INTO v_order FROM public.orders
    WHERE id = p_order_id AND deleted_at IS NULL
    FOR UPDATE;

    IF v_order.id IS NULL OR
       (v_order.customer_id <> v_user_id AND NOT public.is_admin()) THEN
        RAISE EXCEPTION 'Order not found';
    END IF;
    IF v_order.coupon_id IS NOT NULL THEN
        RAISE EXCEPTION 'Order already has a coupon';
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'productId', product_id,
        'quantity', quantity,
        'unitPrice', unit_price
    )), '[]'::jsonb)
    INTO v_items
    FROM public.order_items WHERE order_id = p_order_id;

    v_quote := public.validate_coupon(
        p_code, v_order.restaurant_id, v_items,
        v_order.subtotal, v_order.delivery_charge
    );

    IF NOT COALESCE((v_quote->>'valid')::BOOLEAN, false) THEN
        RAISE EXCEPTION '%', COALESCE(v_quote->>'message', 'Coupon is not valid');
    END IF;

    v_coupon_id := (v_quote->>'couponId')::UUID;
    v_discount := COALESCE((v_quote->>'discountAmount')::NUMERIC, 0);
    v_delivery_discount := COALESCE((v_quote->>'deliveryDiscount')::NUMERIC, 0);

    -- Lock before incrementing to enforce the global cap under concurrency.
    PERFORM 1 FROM public.coupons WHERE id = v_coupon_id FOR UPDATE;
    IF EXISTS (
        SELECT 1 FROM public.coupons
        WHERE id = v_coupon_id
          AND usage_limit IS NOT NULL
          AND usage_count >= usage_limit
    ) THEN
        RAISE EXCEPTION 'Coupon redemption limit reached';
    END IF;

    INSERT INTO public.coupon_usages (
        coupon_id, user_id, order_id, discount_applied
    ) VALUES (
        v_coupon_id, v_order.customer_id, p_order_id,
        v_discount + v_delivery_discount
    );

    UPDATE public.coupons
    SET usage_count = usage_count + 1
    WHERE id = v_coupon_id;

    UPDATE public.coupon_grants
    SET redeemed_at = NOW()
    WHERE coupon_id = v_coupon_id
      AND user_id = v_order.customer_id
      AND redeemed_at IS NULL;

    UPDATE public.orders
    SET coupon_id = v_coupon_id,
        discount_amount = v_discount,
        delivery_charge = GREATEST(delivery_charge - v_delivery_discount, 0),
        grand_total = GREATEST(grand_total - v_discount - v_delivery_discount, 0),
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN v_quote;
END;
$$;

-- Compensating cleanup for checkout failures. RLS intentionally has no direct
-- customer DELETE policy, so cleanup is narrowly constrained here.
CREATE OR REPLACE FUNCTION public.rollback_placed_order(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := public.current_app_user_id();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Login required'; END IF;

    DELETE FROM public.orders
    WHERE id = p_order_id
      AND customer_id = v_user_id
      AND order_status = 'placed'
      AND payment_status = 'pending'
      AND coupon_id IS NULL;
END;
$$;

-- A referral is attached after a profile exists (normally immediately after OTP).
CREATE OR REPLACE FUNCTION public.claim_referral_code(p_referral_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_referred UUID;
    v_referrer UUID;
    v_campaign UUID;
BEGIN
    v_referred := public.current_app_user_id();
    IF v_referred IS NULL THEN RAISE EXCEPTION 'Login required'; END IF;

    SELECT id INTO v_referrer FROM public.users
    WHERE upper(referral_code) = upper(trim(p_referral_code))
      AND deleted_at IS NULL AND is_active = TRUE;

    IF v_referrer IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid referral code');
    END IF;
    IF v_referrer = v_referred THEN
        RETURN jsonb_build_object('success', false, 'message', 'You cannot use your own referral code');
    END IF;
    IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_user_id = v_referred) THEN
        RETURN jsonb_build_object('success', false, 'message', 'A referral is already linked');
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.orders
        WHERE customer_id = v_referred AND deleted_at IS NULL
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Referral must be added before your first order');
    END IF;

    SELECT id INTO v_campaign FROM public.referral_campaigns
    WHERE is_active = TRUE AND deleted_at IS NULL
      AND valid_from <= NOW()
      AND (valid_until IS NULL OR valid_until >= NOW())
    ORDER BY created_at DESC LIMIT 1;

    IF v_campaign IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No active referral campaign');
    END IF;

    INSERT INTO public.referrals (
        campaign_id, referrer_user_id, referred_user_id, referral_code,
        status
    ) VALUES (
        v_campaign, v_referrer, v_referred, upper(trim(p_referral_code)),
        'first_order_pending'
    );

    UPDATE public.users
    SET referred_by_user_id = v_referrer
    WHERE id = v_referred AND referred_by_user_id IS NULL;

    RETURN jsonb_build_object('success', true, 'message', 'Referral code applied');
END;
$$;

-- Exactly-once referral reward when the referred user's first order is delivered.
CREATE OR REPLACE FUNCTION public.issue_referral_reward_on_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_referral public.referrals%ROWTYPE;
    v_campaign public.referral_campaigns%ROWTYPE;
BEGIN
    IF NEW.order_status <> 'delivered'
       OR OLD.order_status = 'delivered' THEN
        RETURN NEW;
    END IF;

    SELECT * INTO v_referral FROM public.referrals
    WHERE referred_user_id = NEW.customer_id
      AND status = 'first_order_pending'
    FOR UPDATE;

    IF v_referral.id IS NULL THEN RETURN NEW; END IF;

    -- Only the chronologically first delivered order can qualify.
    IF EXISTS (
        SELECT 1 FROM public.orders
        WHERE customer_id = NEW.customer_id
          AND order_status = 'delivered'
          AND id <> NEW.id
          AND placed_at < NEW.placed_at
          AND deleted_at IS NULL
    ) THEN
        RETURN NEW;
    END IF;

    SELECT * INTO v_campaign FROM public.referral_campaigns
    WHERE id = v_referral.campaign_id
      AND deleted_at IS NULL;

    IF v_campaign.id IS NULL THEN RETURN NEW; END IF;

    INSERT INTO public.referral_rewards (
        referral_id, beneficiary_user_id, beneficiary_type,
        reward_type, coupon_id, reward_value
    ) VALUES (
        v_referral.id, v_referral.referrer_user_id, 'referrer',
        v_campaign.reward_type, v_campaign.referrer_coupon_id,
        v_campaign.reward_value
    ) ON CONFLICT (referral_id, beneficiary_type) DO NOTHING;

    IF v_campaign.reward_type = 'coupon' AND v_campaign.referrer_coupon_id IS NOT NULL THEN
        INSERT INTO public.coupon_grants (
            coupon_id, user_id, source_type, source_id
        ) VALUES (
            v_campaign.referrer_coupon_id, v_referral.referrer_user_id,
            'referral', v_referral.id
        ) ON CONFLICT DO NOTHING;
    END IF;

    IF v_campaign.referred_coupon_id IS NOT NULL THEN
        INSERT INTO public.referral_rewards (
            referral_id, beneficiary_user_id, beneficiary_type,
            reward_type, coupon_id, reward_value
        ) VALUES (
            v_referral.id, v_referral.referred_user_id, 'referred',
            'coupon', v_campaign.referred_coupon_id, 0
        ) ON CONFLICT (referral_id, beneficiary_type) DO NOTHING;

        INSERT INTO public.coupon_grants (
            coupon_id, user_id, source_type, source_id
        ) VALUES (
            v_campaign.referred_coupon_id, v_referral.referred_user_id,
            'referral', v_referral.id
        ) ON CONFLICT DO NOTHING;
    END IF;

    UPDATE public.referrals
    SET status = 'reward_issued',
        qualifying_order_id = NEW.id,
        rewarded_at = NOW()
    WHERE id = v_referral.id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_issue_referral_reward ON public.orders;
CREATE TRIGGER trg_issue_referral_reward
    AFTER UPDATE OF order_status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.issue_referral_reward_on_delivery();

-- ---------------------------------------------------------------------------
-- RLS: one engine, platform admin or owning business.
-- ---------------------------------------------------------------------------
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coupons_select_available ON public.coupons;
CREATE POLICY coupons_select_available ON public.coupons FOR SELECT USING (
    public.is_admin()
    OR (restaurant_id IS NOT NULL AND public.is_restaurant_owner_of(restaurant_id))
    OR (is_active = TRUE AND deleted_at IS NULL AND is_reward_only = FALSE)
    OR EXISTS (
        SELECT 1 FROM public.coupon_grants g
        WHERE g.coupon_id = coupons.id
          AND g.user_id = public.current_app_user_id()
          AND g.redeemed_at IS NULL
    )
);

DROP POLICY IF EXISTS coupons_admin_all ON public.coupons;
CREATE POLICY coupons_admin_all ON public.coupons FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS coupons_owner_all ON public.coupons;
CREATE POLICY coupons_owner_all ON public.coupons FOR ALL
    USING (
        owner_type = 'business'
        AND restaurant_id IS NOT NULL
        AND public.is_restaurant_owner_of(restaurant_id)
    )
    WITH CHECK (
        owner_type = 'business'
        AND restaurant_id IS NOT NULL
        AND public.is_restaurant_owner_of(restaurant_id)
    );

DROP POLICY IF EXISTS coupon_usages_related ON public.coupon_usages;
CREATE POLICY coupon_usages_related ON public.coupon_usages FOR SELECT USING (
    public.is_admin()
    OR user_id = public.current_app_user_id()
    OR EXISTS (
        SELECT 1 FROM public.coupons c
        WHERE c.id = coupon_usages.coupon_id
          AND c.restaurant_id IS NOT NULL
          AND public.is_restaurant_owner_of(c.restaurant_id)
    )
);

-- Target tables inherit authorization from their coupon.
DROP POLICY IF EXISTS coupon_businesses_manage ON public.coupon_businesses;
CREATE POLICY coupon_businesses_manage ON public.coupon_businesses FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.coupons c WHERE c.id = coupon_id
      AND (public.is_admin() OR public.is_restaurant_owner_of(c.restaurant_id))
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.coupons c WHERE c.id = coupon_id
      AND (public.is_admin() OR public.is_restaurant_owner_of(c.restaurant_id))
));

DROP POLICY IF EXISTS coupon_categories_manage ON public.coupon_categories;
CREATE POLICY coupon_categories_manage ON public.coupon_categories FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.coupons c WHERE c.id = coupon_id
      AND (public.is_admin() OR public.is_restaurant_owner_of(c.restaurant_id))
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.coupons c WHERE c.id = coupon_id
      AND (public.is_admin() OR public.is_restaurant_owner_of(c.restaurant_id))
));

DROP POLICY IF EXISTS coupon_products_manage ON public.coupon_products;
CREATE POLICY coupon_products_manage ON public.coupon_products FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.coupons c WHERE c.id = coupon_id
      AND (public.is_admin() OR public.is_restaurant_owner_of(c.restaurant_id))
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.coupons c WHERE c.id = coupon_id
      AND (public.is_admin() OR public.is_restaurant_owner_of(c.restaurant_id))
));

DROP POLICY IF EXISTS coupon_grants_select_own ON public.coupon_grants;
CREATE POLICY coupon_grants_select_own ON public.coupon_grants FOR SELECT USING (
    public.is_admin() OR user_id = public.current_app_user_id()
);

DROP POLICY IF EXISTS referral_campaigns_select_active ON public.referral_campaigns;
CREATE POLICY referral_campaigns_select_active ON public.referral_campaigns FOR SELECT USING (
    public.is_admin() OR (is_active = TRUE AND deleted_at IS NULL)
);
DROP POLICY IF EXISTS referral_campaigns_admin_all ON public.referral_campaigns;
CREATE POLICY referral_campaigns_admin_all ON public.referral_campaigns FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS referrals_related ON public.referrals;
CREATE POLICY referrals_related ON public.referrals FOR SELECT USING (
    public.is_admin()
    OR referrer_user_id = public.current_app_user_id()
    OR referred_user_id = public.current_app_user_id()
);

DROP POLICY IF EXISTS referral_rewards_related ON public.referral_rewards;
CREATE POLICY referral_rewards_related ON public.referral_rewards FOR SELECT USING (
    public.is_admin() OR beneficiary_user_id = public.current_app_user_id()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT SELECT ON public.coupon_usages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupon_businesses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupon_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupon_products TO authenticated;
GRANT SELECT ON public.coupon_grants TO authenticated;
GRANT SELECT ON public.referral_campaigns TO authenticated;
GRANT SELECT ON public.referrals TO authenticated;
GRANT SELECT ON public.referral_rewards TO authenticated;

GRANT EXECUTE ON FUNCTION public.validate_coupon(TEXT, UUID, JSONB, NUMERIC, NUMERIC)
    TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_coupon_for_order(UUID, TEXT)
    TO authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_placed_order(UUID)
    TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_referral_code(TEXT)
    TO authenticated;

NOTIFY pgrst, 'reload schema';

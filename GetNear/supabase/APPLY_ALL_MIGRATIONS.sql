-- GetNear: run this once in Supabase Dashboard → SQL Editor → New query → Run
-- Applies migrations 000 through 026
--
-- Fresh reset:
--   1) Run RESET_DATABASE.sql
--   2) Run this file
-- Admin seed (024): phone + password in auth.users (default GetNear@123). No admin OTP.


-- ============================================================================
-- FILE: 000_init_extensions_and_functions.sql
-- ============================================================================

-- ============================================================================
-- Migration: 000_init_extensions_and_functions
-- Purpose: Enable required PostgreSQL extensions and shared trigger utilities.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

COMMENT ON EXTENSION "pgcrypto" IS 'Provides gen_random_uuid() for UUID primary key generation.';

-- Reusable trigger function to auto-update updated_at on row modification.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
    'Trigger function that sets updated_at to current timestamp before UPDATE.';



-- ============================================================================
-- FILE: 001_create_roles.sql
-- ============================================================================

-- ============================================================================
-- Migration: 001_create_roles
-- Purpose: Defines application roles (customer, restaurant_owner, admin, etc.).
--          Separates authorization from Supabase auth.users.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    slug VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT roles_name_not_empty CHECK (char_length(trim(name)) > 0),
    CONSTRAINT roles_slug_not_empty CHECK (char_length(trim(slug)) > 0),
    CONSTRAINT roles_slug_format CHECK (slug ~ '^[a-z][a-z0-9_]*$')
);

COMMENT ON TABLE public.roles IS
    'Application-level roles for RBAC. Decoupled from auth.users for flexible permission management.';

COMMENT ON COLUMN public.roles.slug IS
    'Machine-readable role identifier (e.g. customer, admin, restaurant_owner).';

COMMENT ON COLUMN public.roles.deleted_at IS
    'Soft delete timestamp. NULL means role is active in the system.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_slug_active
    ON public.roles (slug)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_name_active
    ON public.roles (name)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_roles_is_active ON public.roles (is_active);

DROP TRIGGER IF EXISTS trg_roles_updated_at ON public.roles;
CREATE TRIGGER trg_roles_updated_at
    BEFORE UPDATE ON public.roles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Seed default roles (idempotent).
INSERT INTO public.roles (name, slug, description)
SELECT v.name, v.slug, v.description
FROM (
    VALUES
        ('Customer', 'customer', 'End user who browses menu and places orders'),
        ('Restaurant Owner', 'restaurant_owner', 'Manages restaurant operations; created by admin only'),
        ('Admin', 'admin', 'Platform administrator with operational access'),
        ('Super Admin', 'super_admin', 'Full platform control including restaurant onboarding')
) AS v(name, slug, description)
WHERE NOT EXISTS (
    SELECT 1 FROM public.roles r WHERE r.slug = v.slug AND r.deleted_at IS NULL
);



-- ============================================================================
-- FILE: 002_create_users.sql
-- ============================================================================

-- ============================================================================
-- Migration: 002_create_users
-- Purpose: Application user profiles linked to Supabase Auth.
--          Application code must query this table, never auth.users directly.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_uuid UUID NOT NULL,
    role_id UUID NOT NULL,
    full_name VARCHAR(150),
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    profile_image TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT users_auth_user_uuid_unique UNIQUE (auth_user_uuid),
    CONSTRAINT users_phone_not_empty CHECK (char_length(trim(phone)) >= 10),
    CONSTRAINT users_email_format CHECK (
        email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    ),

    CONSTRAINT fk_users_role_id
        FOREIGN KEY (role_id)
        REFERENCES public.roles (id)
        ON DELETE RESTRICT
);

COMMENT ON TABLE public.users IS
    'Application user profiles. Maps auth.users to roles and business data.';

COMMENT ON COLUMN public.users.auth_user_uuid IS
    'References auth.users.id from Supabase Auth. Not exposed to frontend queries directly.';

COMMENT ON COLUMN public.users.phone IS
    'Primary identifier for customer OTP login. Must be unique among active users.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_active
    ON public.users (phone)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_active
    ON public.users (email)
    WHERE deleted_at IS NULL AND email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_role_id ON public.users (role_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users (is_active);
CREATE INDEX IF NOT EXISTS idx_users_auth_user_uuid ON public.users (auth_user_uuid);

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();



-- ============================================================================
-- FILE: 003_create_restaurants.sql
-- ============================================================================

-- ============================================================================
-- Migration: 003_create_restaurants
-- Purpose: Core restaurant entity. Designed for multi-restaurant scalability
--          while supporting single-restaurant launch.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    description TEXT,
    gst_number VARCHAR(20),
    fssai_number VARCHAR(20),
    logo_url TEXT,
    banner_url TEXT,
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    business_status VARCHAR(30) NOT NULL DEFAULT 'active',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT restaurants_name_not_empty CHECK (char_length(trim(name)) > 0),
    CONSTRAINT restaurants_slug_not_empty CHECK (char_length(trim(slug)) > 0),
    CONSTRAINT restaurants_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT restaurants_business_status_check CHECK (
        business_status IN ('active', 'inactive', 'suspended', 'pending_approval')
    ),
    CONSTRAINT restaurants_contact_email_format CHECK (
        contact_email IS NULL OR contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    ),

    CONSTRAINT fk_restaurants_owner_id
        FOREIGN KEY (owner_id)
        REFERENCES public.users (id)
        ON DELETE SET NULL
);

COMMENT ON TABLE public.restaurants IS
    'Restaurant master record. Each restaurant can have multiple branches and a full catalog.';

COMMENT ON COLUMN public.restaurants.gst_number IS 'Indian GST registration number for tax compliance.';
COMMENT ON COLUMN public.restaurants.fssai_number IS 'Food safety license number (FSSAI).';
COMMENT ON COLUMN public.restaurants.business_status IS
    'Operational status: active, inactive, suspended, pending_approval.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurants_slug_active
    ON public.restaurants (slug)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON public.restaurants (owner_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_business_status ON public.restaurants (business_status);
CREATE INDEX IF NOT EXISTS idx_restaurants_is_active ON public.restaurants (is_active);
CREATE INDEX IF NOT EXISTS idx_restaurants_name ON public.restaurants (name);

DROP TRIGGER IF EXISTS trg_restaurants_updated_at ON public.restaurants;
CREATE TRIGGER trg_restaurants_updated_at
    BEFORE UPDATE ON public.restaurants
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();



-- ============================================================================
-- FILE: 004_create_restaurant_branches.sql
-- ============================================================================

-- ============================================================================
-- Migration: 004_create_restaurant_branches
-- Purpose: Physical/virtual outlets per restaurant. Used for nearest-branch
--          selection based on customer geolocation.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.restaurant_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    phone VARCHAR(20),
    is_main_branch BOOLEAN NOT NULL DEFAULT FALSE,
    delivery_radius_km DECIMAL(6, 2) NOT NULL DEFAULT 5.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT restaurant_branches_name_not_empty CHECK (char_length(trim(name)) > 0),
    CONSTRAINT restaurant_branches_latitude_range CHECK (latitude >= -90 AND latitude <= 90),
    CONSTRAINT restaurant_branches_longitude_range CHECK (longitude >= -180 AND longitude <= 180),
    CONSTRAINT restaurant_branches_delivery_radius_positive CHECK (delivery_radius_km > 0),
    CONSTRAINT restaurant_branches_pincode_format CHECK (pincode ~ '^[0-9]{6}$'),

    CONSTRAINT fk_restaurant_branches_restaurant_id
        FOREIGN KEY (restaurant_id)
        REFERENCES public.restaurants (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.restaurant_branches IS
    'Restaurant branch/outlet locations. Supports multi-branch delivery and geo-based routing.';

COMMENT ON COLUMN public.restaurant_branches.latitude IS
    'Branch latitude for Haversine distance calculation against customer location.';

COMMENT ON COLUMN public.restaurant_branches.longitude IS
    'Branch longitude for Haversine distance calculation against customer location.';

COMMENT ON COLUMN public.restaurant_branches.is_main_branch IS
    'Flags the primary branch when multiple branches exist for one restaurant.';

CREATE INDEX IF NOT EXISTS idx_restaurant_branches_restaurant_id
    ON public.restaurant_branches (restaurant_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_branches_city ON public.restaurant_branches (city);
CREATE INDEX IF NOT EXISTS idx_restaurant_branches_pincode ON public.restaurant_branches (pincode);
CREATE INDEX IF NOT EXISTS idx_restaurant_branches_is_active ON public.restaurant_branches (is_active);
CREATE INDEX IF NOT EXISTS idx_restaurant_branches_geo
    ON public.restaurant_branches (latitude, longitude);

CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_branches_main_branch
    ON public.restaurant_branches (restaurant_id)
    WHERE is_main_branch = TRUE AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_restaurant_branches_updated_at ON public.restaurant_branches;
CREATE TRIGGER trg_restaurant_branches_updated_at
    BEFORE UPDATE ON public.restaurant_branches
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();



-- ============================================================================
-- FILE: 005_create_addresses.sql
-- ============================================================================

-- ============================================================================
-- Migration: 005_create_addresses
-- Purpose: Customer delivery addresses linked to application users.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    label VARCHAR(50) NOT NULL DEFAULT 'home',
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT addresses_label_check CHECK (label IN ('home', 'work', 'other')),
    CONSTRAINT addresses_full_name_not_empty CHECK (char_length(trim(full_name)) > 0),
    CONSTRAINT addresses_phone_not_empty CHECK (char_length(trim(phone)) >= 10),
    CONSTRAINT addresses_pincode_format CHECK (pincode ~ '^[0-9]{6}$'),
    CONSTRAINT addresses_latitude_range CHECK (
        latitude IS NULL OR (latitude >= -90 AND latitude <= 90)
    ),
    CONSTRAINT addresses_longitude_range CHECK (
        longitude IS NULL OR (longitude >= -180 AND longitude <= 180)
    ),

    CONSTRAINT fk_addresses_user_id
        FOREIGN KEY (user_id)
        REFERENCES public.users (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.addresses IS
    'Saved delivery addresses for authenticated customers at checkout.';

COMMENT ON COLUMN public.addresses.is_default IS
    'Default address auto-selected during checkout. Enforce one default per user in app logic.';

CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON public.addresses (user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_pincode ON public.addresses (pincode);
CREATE INDEX IF NOT EXISTS idx_addresses_city ON public.addresses (city);
CREATE INDEX IF NOT EXISTS idx_addresses_is_default ON public.addresses (user_id, is_default);

CREATE UNIQUE INDEX IF NOT EXISTS idx_addresses_user_default
    ON public.addresses (user_id)
    WHERE is_default = TRUE AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_addresses_updated_at ON public.addresses;
CREATE TRIGGER trg_addresses_updated_at
    BEFORE UPDATE ON public.addresses
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();



-- ============================================================================
-- FILE: 006_create_categories.sql
-- ============================================================================

-- ============================================================================
-- Migration: 006_create_categories
-- Purpose: Menu categories scoped per restaurant for filtering and navigation.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) NOT NULL,
    description TEXT,
    image_url TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT categories_name_not_empty CHECK (char_length(trim(name)) > 0),
    CONSTRAINT categories_slug_not_empty CHECK (char_length(trim(slug)) > 0),
    CONSTRAINT categories_display_order_non_negative CHECK (display_order >= 0),

    CONSTRAINT fk_categories_restaurant_id
        FOREIGN KEY (restaurant_id)
        REFERENCES public.restaurants (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.categories IS
    'Product categories for menu organization. Scoped to restaurant for multi-tenant support.';

COMMENT ON COLUMN public.categories.display_order IS
    'Controls category sort order in customer menu UI.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_restaurant_slug_active
    ON public.categories (restaurant_id, slug)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_categories_restaurant_id ON public.categories (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_categories_name ON public.categories (name);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON public.categories (is_active);
CREATE INDEX IF NOT EXISTS idx_categories_display_order
    ON public.categories (restaurant_id, display_order);

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();



-- ============================================================================
-- FILE: 007_create_products.sql
-- ============================================================================

-- ============================================================================
-- Migration: 007_create_products
-- Purpose: Menu items with pricing, availability, and dietary classification.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    category_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    description TEXT,
    food_type VARCHAR(20) NOT NULL DEFAULT 'veg',
    mrp DECIMAL(10, 2) NOT NULL,
    selling_price DECIMAL(10, 2) NOT NULL,
    discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    preparation_time_minutes INTEGER NOT NULL DEFAULT 15,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    primary_image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT products_name_not_empty CHECK (char_length(trim(name)) > 0),
    CONSTRAINT products_food_type_check CHECK (food_type IN ('veg', 'non_veg', 'egg')),
    CONSTRAINT products_mrp_positive CHECK (mrp >= 0),
    CONSTRAINT products_selling_price_positive CHECK (selling_price >= 0),
    CONSTRAINT products_selling_price_lte_mrp CHECK (selling_price <= mrp),
    CONSTRAINT products_discount_non_negative CHECK (discount_amount >= 0),
    CONSTRAINT products_preparation_time_positive CHECK (preparation_time_minutes > 0),

    CONSTRAINT fk_products_restaurant_id
        FOREIGN KEY (restaurant_id)
        REFERENCES public.restaurants (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_products_category_id
        FOREIGN KEY (category_id)
        REFERENCES public.categories (id)
        ON DELETE RESTRICT
);

COMMENT ON TABLE public.products IS
    'Restaurant menu products. Supports search, filter, cart, and order line items.';

COMMENT ON COLUMN public.products.food_type IS 'Dietary classification: veg, non_veg, or egg.';
COMMENT ON COLUMN public.products.mrp IS 'Maximum retail price before discount.';
COMMENT ON COLUMN public.products.selling_price IS 'Customer-facing price after discount.';
COMMENT ON COLUMN public.products.primary_image_url IS
    'Denormalized primary image for fast menu listing; detailed images in product_images.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_restaurant_slug_active
    ON public.products (restaurant_id, slug)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_restaurant_id ON public.products (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products (name);
CREATE INDEX IF NOT EXISTS idx_products_food_type ON public.products (food_type);
CREATE INDEX IF NOT EXISTS idx_products_is_available ON public.products (is_available);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON public.products (is_featured);
CREATE INDEX IF NOT EXISTS idx_products_selling_price ON public.products (selling_price);

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();



-- ============================================================================
-- FILE: 008_create_product_images.sql
-- ============================================================================

-- ============================================================================
-- Migration: 008_create_product_images
-- Purpose: Multiple images per product stored in Supabase Storage.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    image_url TEXT NOT NULL,
    storage_path TEXT,
    alt_text VARCHAR(255),
    display_order INTEGER NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT product_images_url_not_empty CHECK (char_length(trim(image_url)) > 0),
    CONSTRAINT product_images_display_order_non_negative CHECK (display_order >= 0),

    CONSTRAINT fk_product_images_product_id
        FOREIGN KEY (product_id)
        REFERENCES public.products (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.product_images IS
    'Gallery images for products. Supports admin-managed media and CDN URLs.';

COMMENT ON COLUMN public.product_images.storage_path IS
    'Supabase Storage object path for image lifecycle management.';

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images (product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_display_order
    ON public.product_images (product_id, display_order);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_primary
    ON public.product_images (product_id)
    WHERE is_primary = TRUE;

DROP TRIGGER IF EXISTS trg_product_images_updated_at ON public.product_images;
CREATE TRIGGER trg_product_images_updated_at
    BEFORE UPDATE ON public.product_images
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();



-- ============================================================================
-- FILE: 009_create_cart.sql
-- ============================================================================

-- ============================================================================
-- Migration: 009_create_cart
-- Purpose: Shopping cart for guest and authenticated users before checkout.
--          Guest carts use session_id; logged-in users use user_id.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cart (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    session_id VARCHAR(255),
    restaurant_branch_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT cart_owner_required CHECK (
        user_id IS NOT NULL OR session_id IS NOT NULL
    ),

    CONSTRAINT fk_cart_user_id
        FOREIGN KEY (user_id)
        REFERENCES public.users (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_cart_restaurant_branch_id
        FOREIGN KEY (restaurant_branch_id)
        REFERENCES public.restaurant_branches (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.cart IS
    'Pre-checkout cart container. Supports anonymous browsing with session-based carts.';

COMMENT ON COLUMN public.cart.session_id IS
    'Browser session identifier for guest cart before phone OTP login.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_user_branch
    ON public.cart (user_id, restaurant_branch_id)
    WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_session_branch
    ON public.cart (session_id, restaurant_branch_id)
    WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cart_restaurant_branch_id ON public.cart (restaurant_branch_id);

DROP TRIGGER IF EXISTS trg_cart_updated_at ON public.cart;
CREATE TRIGGER trg_cart_updated_at
    BEFORE UPDATE ON public.cart
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();



-- ============================================================================
-- FILE: 010_create_cart_items.sql
-- ============================================================================

-- ============================================================================
-- Migration: 010_create_cart_items
-- Purpose: Line items inside a cart with quantity and price snapshot.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT cart_items_quantity_positive CHECK (quantity > 0),
    CONSTRAINT cart_items_unit_price_non_negative CHECK (unit_price >= 0),

    CONSTRAINT fk_cart_items_cart_id
        FOREIGN KEY (cart_id)
        REFERENCES public.cart (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_cart_items_product_id
        FOREIGN KEY (product_id)
        REFERENCES public.products (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.cart_items IS
    'Individual products added to cart. unit_price snapshots current selling price.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_cart_product
    ON public.cart_items (cart_id, product_id);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON public.cart_items (cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON public.cart_items (product_id);

DROP TRIGGER IF EXISTS trg_cart_items_updated_at ON public.cart_items;
CREATE TRIGGER trg_cart_items_updated_at
    BEFORE UPDATE ON public.cart_items
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();



-- ============================================================================
-- FILE: 011_create_coupons.sql
-- ============================================================================

-- ============================================================================
-- Migration: 011_create_coupons
-- Purpose: Discount coupons managed by admin per restaurant.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    title VARCHAR(150),
    description TEXT,
    discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage',
    discount_value DECIMAL(10, 2) NOT NULL,
    min_order_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    max_discount_amount DECIMAL(10, 2),
    usage_limit INTEGER,
    usage_count INTEGER NOT NULL DEFAULT 0,
    per_user_limit INTEGER NOT NULL DEFAULT 1,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT coupons_code_not_empty CHECK (char_length(trim(code)) > 0),
    CONSTRAINT coupons_discount_type_check CHECK (discount_type IN ('percentage', 'flat')),
    CONSTRAINT coupons_discount_value_positive CHECK (discount_value > 0),
    CONSTRAINT coupons_min_order_non_negative CHECK (min_order_amount >= 0),
    CONSTRAINT coupons_usage_count_non_negative CHECK (usage_count >= 0),
    CONSTRAINT coupons_usage_limit_positive CHECK (usage_limit IS NULL OR usage_limit > 0),
    CONSTRAINT coupons_per_user_limit_positive CHECK (per_user_limit > 0),
    CONSTRAINT coupons_percentage_max CHECK (
        discount_type != 'percentage' OR discount_value <= 100
    ),
    CONSTRAINT coupons_validity_check CHECK (
        valid_until IS NULL OR valid_until > valid_from
    ),

    CONSTRAINT fk_coupons_restaurant_id
        FOREIGN KEY (restaurant_id)
        REFERENCES public.restaurants (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.coupons IS
    'Promotional coupon codes applied at checkout with usage limits and validity windows.';

COMMENT ON COLUMN public.coupons.per_user_limit IS
    'Maximum times a single customer can redeem this coupon.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_restaurant_code_active
    ON public.coupons (restaurant_id, upper(code))
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_coupons_restaurant_id ON public.coupons (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON public.coupons (is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_validity ON public.coupons (valid_from, valid_until);

DROP TRIGGER IF EXISTS trg_coupons_updated_at ON public.coupons;
CREATE TRIGGER trg_coupons_updated_at
    BEFORE UPDATE ON public.coupons
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();



-- ============================================================================
-- FILE: 012_create_offers.sql
-- ============================================================================

-- ============================================================================
-- Migration: 012_create_offers
-- Purpose: Marketing offers and banners displayed on customer-facing UI.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    offer_type VARCHAR(30) NOT NULL DEFAULT 'banner',
    discount_value DECIMAL(10, 2),
    image_url TEXT,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT offers_title_not_empty CHECK (char_length(trim(title)) > 0),
    CONSTRAINT offers_type_check CHECK (
        offer_type IN ('banner', 'flat_discount', 'percentage_discount', 'free_delivery')
    ),
    CONSTRAINT offers_validity_check CHECK (
        valid_until IS NULL OR valid_until > valid_from
    ),

    CONSTRAINT fk_offers_restaurant_id
        FOREIGN KEY (restaurant_id)
        REFERENCES public.restaurants (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.offers IS
    'Promotional offers for homepage banners and campaign-driven discounts.';

CREATE INDEX IF NOT EXISTS idx_offers_restaurant_id ON public.offers (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_offers_is_active ON public.offers (is_active);
CREATE INDEX IF NOT EXISTS idx_offers_validity ON public.offers (valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_offers_offer_type ON public.offers (offer_type);

DROP TRIGGER IF EXISTS trg_offers_updated_at ON public.offers;
CREATE TRIGGER trg_offers_updated_at
    BEFORE UPDATE ON public.offers
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();



-- ============================================================================
-- FILE: 013_create_business_settings.sql
-- ============================================================================

-- ============================================================================
-- Migration: 013_create_business_settings
-- Purpose: Per-restaurant operational and tax configuration.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.business_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 5.00,
    min_order_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    enable_cod BOOLEAN NOT NULL DEFAULT FALSE,
    enable_online_payment BOOLEAN NOT NULL DEFAULT TRUE,
    order_prefix VARCHAR(10) NOT NULL DEFAULT 'GN',
    support_phone VARCHAR(20),
    support_email VARCHAR(255),
    additional_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT business_settings_tax_rate_non_negative CHECK (tax_rate >= 0),
    CONSTRAINT business_settings_min_order_non_negative CHECK (min_order_amount >= 0),
    CONSTRAINT business_settings_currency_not_empty CHECK (char_length(trim(currency)) > 0),

    CONSTRAINT fk_business_settings_restaurant_id
        FOREIGN KEY (restaurant_id)
        REFERENCES public.restaurants (id)
        ON DELETE CASCADE,

    CONSTRAINT business_settings_restaurant_unique UNIQUE (restaurant_id)
);

COMMENT ON TABLE public.business_settings IS
    'Restaurant-level business rules: tax, minimum order, payment modes, and extensible JSON config.';

COMMENT ON COLUMN public.business_settings.additional_settings IS
    'JSONB extension point for future settings without schema migration.';

CREATE INDEX IF NOT EXISTS idx_business_settings_restaurant_id
    ON public.business_settings (restaurant_id);

DROP TRIGGER IF EXISTS trg_business_settings_updated_at ON public.business_settings;
CREATE TRIGGER trg_business_settings_updated_at
    BEFORE UPDATE ON public.business_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();



-- ============================================================================
-- FILE: 014_create_delivery_charges.sql
-- ============================================================================

-- ============================================================================
-- Migration: 014_create_delivery_charges
-- Purpose: Configurable delivery fee rules by restaurant and optionally branch.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.delivery_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    branch_id UUID,
    min_order_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    max_order_amount DECIMAL(10, 2),
    charge_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    is_free_delivery BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT delivery_charges_min_order_non_negative CHECK (min_order_amount >= 0),
    CONSTRAINT delivery_charges_charge_non_negative CHECK (charge_amount >= 0),
    CONSTRAINT delivery_charges_range_valid CHECK (
        max_order_amount IS NULL OR max_order_amount >= min_order_amount
    ),

    CONSTRAINT fk_delivery_charges_restaurant_id
        FOREIGN KEY (restaurant_id)
        REFERENCES public.restaurants (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_delivery_charges_branch_id
        FOREIGN KEY (branch_id)
        REFERENCES public.restaurant_branches (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.delivery_charges IS
    'Slab-based delivery charge rules. branch_id NULL means restaurant-wide default.';

CREATE INDEX IF NOT EXISTS idx_delivery_charges_restaurant_id
    ON public.delivery_charges (restaurant_id);

CREATE INDEX IF NOT EXISTS idx_delivery_charges_branch_id
    ON public.delivery_charges (branch_id);

CREATE INDEX IF NOT EXISTS idx_delivery_charges_is_active
    ON public.delivery_charges (is_active);

CREATE INDEX IF NOT EXISTS idx_delivery_charges_order_range
    ON public.delivery_charges (restaurant_id, min_order_amount, max_order_amount);

DROP TRIGGER IF EXISTS trg_delivery_charges_updated_at ON public.delivery_charges;
CREATE TRIGGER trg_delivery_charges_updated_at
    BEFORE UPDATE ON public.delivery_charges
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();



-- ============================================================================
-- FILE: 015_create_operating_hours.sql
-- ============================================================================

-- ============================================================================
-- Migration: 015_create_operating_hours
-- Purpose: Branch-wise weekly opening and closing schedules.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.operating_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL,
    day_of_week SMALLINT NOT NULL,
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT operating_hours_day_range CHECK (day_of_week >= 0 AND day_of_week <= 6),
    CONSTRAINT operating_hours_time_valid CHECK (
        is_closed = TRUE OR close_time > open_time
    ),

    CONSTRAINT fk_operating_hours_branch_id
        FOREIGN KEY (branch_id)
        REFERENCES public.restaurant_branches (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.operating_hours IS
    'Weekly operating schedule per branch. day_of_week: 0=Sunday, 6=Saturday.';

COMMENT ON COLUMN public.operating_hours.is_closed IS
    'When TRUE, branch is closed entire day regardless of open/close times.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_operating_hours_branch_day
    ON public.operating_hours (branch_id, day_of_week);

CREATE INDEX IF NOT EXISTS idx_operating_hours_branch_id
    ON public.operating_hours (branch_id);

DROP TRIGGER IF EXISTS trg_operating_hours_updated_at ON public.operating_hours;
CREATE TRIGGER trg_operating_hours_updated_at
    BEFORE UPDATE ON public.operating_hours
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();



-- ============================================================================
-- FILE: 016_create_holidays.sql
-- ============================================================================

-- ============================================================================
-- Migration: 016_create_holidays
-- Purpose: Planned closures for restaurants or specific branches.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    branch_id UUID,
    holiday_date DATE NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    is_full_day_closed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT holidays_title_not_empty CHECK (char_length(trim(title)) > 0),

    CONSTRAINT fk_holidays_restaurant_id
        FOREIGN KEY (restaurant_id)
        REFERENCES public.restaurants (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_holidays_branch_id
        FOREIGN KEY (branch_id)
        REFERENCES public.restaurant_branches (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.holidays IS
    'Holiday calendar for restaurant-wide or branch-specific closures.';

COMMENT ON COLUMN public.holidays.branch_id IS
    'NULL means holiday applies to all branches of the restaurant.';

CREATE INDEX IF NOT EXISTS idx_holidays_restaurant_id ON public.holidays (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_holidays_branch_id ON public.holidays (branch_id);
CREATE INDEX IF NOT EXISTS idx_holidays_holiday_date ON public.holidays (holiday_date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_holidays_restaurant_branch_date_active
    ON public.holidays (restaurant_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), holiday_date)
    WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_holidays_updated_at ON public.holidays;
CREATE TRIGGER trg_holidays_updated_at
    BEFORE UPDATE ON public.holidays
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();



-- ============================================================================
-- FILE: 017_create_orders.sql
-- ============================================================================

-- ============================================================================
-- Migration: 017_create_orders
-- Purpose: Customer order header with pricing breakdown and payment tracking.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(30) NOT NULL,
    restaurant_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    address_id UUID NOT NULL,
    coupon_id UUID,
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    delivery_charge DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    grand_total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    order_status VARCHAR(30) NOT NULL DEFAULT 'placed',
    payment_method VARCHAR(30) NOT NULL DEFAULT 'razorpay',
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    customer_notes TEXT,
    cancelled_reason TEXT,
    placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT orders_order_number_not_empty CHECK (char_length(trim(order_number)) > 0),
    CONSTRAINT orders_subtotal_non_negative CHECK (subtotal >= 0),
    CONSTRAINT orders_discount_non_negative CHECK (discount_amount >= 0),
    CONSTRAINT orders_delivery_charge_non_negative CHECK (delivery_charge >= 0),
    CONSTRAINT orders_tax_non_negative CHECK (tax_amount >= 0),
    CONSTRAINT orders_grand_total_non_negative CHECK (grand_total >= 0),
    CONSTRAINT orders_payment_status_check CHECK (
        payment_status IN ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')
    ),
    CONSTRAINT orders_order_status_check CHECK (
        order_status IN (
            'placed', 'confirmed', 'preparing', 'ready',
            'out_for_delivery', 'delivered', 'cancelled'
        )
    ),
    CONSTRAINT orders_payment_method_check CHECK (
        payment_method IN ('razorpay', 'cod', 'wallet')
    ),

    CONSTRAINT fk_orders_restaurant_id
        FOREIGN KEY (restaurant_id)
        REFERENCES public.restaurants (id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_orders_branch_id
        FOREIGN KEY (branch_id)
        REFERENCES public.restaurant_branches (id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_orders_customer_id
        FOREIGN KEY (customer_id)
        REFERENCES public.users (id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_orders_address_id
        FOREIGN KEY (address_id)
        REFERENCES public.addresses (id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_orders_coupon_id
        FOREIGN KEY (coupon_id)
        REFERENCES public.coupons (id)
        ON DELETE SET NULL
);

COMMENT ON TABLE public.orders IS
    'Order master record with financial summary and Razorpay payment references.';

COMMENT ON COLUMN public.orders.order_number IS
    'Human-readable order ID shown to customers (e.g. GN-20260708-0001).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders (order_number);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON public.orders (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_branch_id ON public.orders (branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders (payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON public.orders (order_status);
CREATE INDEX IF NOT EXISTS idx_orders_placed_at ON public.orders (placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id ON public.orders (razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_payment_id ON public.orders (razorpay_payment_id);

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();



-- ============================================================================
-- FILE: 018_create_order_items.sql
-- ============================================================================

-- ============================================================================
-- Migration: 018_create_order_items
-- Purpose: Immutable line-item snapshot for each product in an order.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    product_id UUID NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    food_type VARCHAR(20) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT order_items_quantity_positive CHECK (quantity > 0),
    CONSTRAINT order_items_unit_price_non_negative CHECK (unit_price >= 0),
    CONSTRAINT order_items_total_price_non_negative CHECK (total_price >= 0),
    CONSTRAINT order_items_food_type_check CHECK (food_type IN ('veg', 'non_veg', 'egg')),
    CONSTRAINT order_items_product_name_not_empty CHECK (char_length(trim(product_name)) > 0),
    CONSTRAINT order_items_total_matches CHECK (total_price = (unit_price * quantity)),

    CONSTRAINT fk_order_items_order_id
        FOREIGN KEY (order_id)
        REFERENCES public.orders (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_order_items_product_id
        FOREIGN KEY (product_id)
        REFERENCES public.products (id)
        ON DELETE RESTRICT
);

COMMENT ON TABLE public.order_items IS
    'Order line items with denormalized product snapshot for historical accuracy.';

COMMENT ON COLUMN public.order_items.product_name IS
    'Snapshot of product name at order time; survives future product renames.';

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items (product_id);

DROP TRIGGER IF EXISTS trg_order_items_updated_at ON public.order_items;
CREATE TRIGGER trg_order_items_updated_at
    BEFORE UPDATE ON public.order_items
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();



-- ============================================================================
-- FILE: 019_create_payments.sql
-- ============================================================================

-- ============================================================================
-- Migration: 019_create_payments
-- Purpose: Payment transaction log including Razorpay webhook payloads.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    transaction_id VARCHAR(150) NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'razorpay',
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    webhook_response JSONB,
    failure_reason TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT payments_transaction_id_not_empty CHECK (char_length(trim(transaction_id)) > 0),
    CONSTRAINT payments_amount_positive CHECK (amount > 0),
    CONSTRAINT payments_provider_check CHECK (provider IN ('razorpay', 'cod', 'wallet')),
    CONSTRAINT payments_status_check CHECK (
        status IN ('pending', 'success', 'failed', 'refunded', 'partially_refunded')
    ),

    CONSTRAINT fk_payments_order_id
        FOREIGN KEY (order_id)
        REFERENCES public.orders (id)
        ON DELETE RESTRICT
);

COMMENT ON TABLE public.payments IS
    'Payment audit trail for reconciliation, refunds, and webhook processing.';

COMMENT ON COLUMN public.payments.webhook_response IS
    'Raw Razorpay webhook JSON for debugging and dispute resolution.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_transaction_id ON public.payments (transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON public.payments (provider);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments (paid_at DESC);

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();



-- ============================================================================
-- FILE: 020_create_coupon_usages.sql
-- ============================================================================

-- ============================================================================
-- Migration: 020_create_coupon_usages
-- Purpose: Tracks coupon redemption per user and order for limit enforcement.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.coupon_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL,
    user_id UUID NOT NULL,
    order_id UUID NOT NULL,
    discount_applied DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT coupon_usages_discount_non_negative CHECK (discount_applied >= 0),

    CONSTRAINT fk_coupon_usages_coupon_id
        FOREIGN KEY (coupon_id)
        REFERENCES public.coupons (id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_coupon_usages_user_id
        FOREIGN KEY (user_id)
        REFERENCES public.users (id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_coupon_usages_order_id
        FOREIGN KEY (order_id)
        REFERENCES public.orders (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.coupon_usages IS
    'Immutable coupon redemption records for analytics and per-user usage limits.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_usages_order_unique
    ON public.coupon_usages (order_id);

CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon_id ON public.coupon_usages (coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_user_id ON public.coupon_usages (user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon_user
    ON public.coupon_usages (coupon_id, user_id);



-- ============================================================================
-- FILE: 021_create_notifications.sql
-- ============================================================================

-- ============================================================================
-- Migration: 021_create_notifications
-- Purpose: In-app notifications for order updates and promotional messages.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL DEFAULT 'general',
    reference_type VARCHAR(50),
    reference_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT notifications_title_not_empty CHECK (char_length(trim(title)) > 0),
    CONSTRAINT notifications_message_not_empty CHECK (char_length(trim(message)) > 0),
    CONSTRAINT notifications_type_check CHECK (
        notification_type IN ('general', 'order', 'payment', 'promotion', 'system')
    ),

    CONSTRAINT fk_notifications_user_id
        FOREIGN KEY (user_id)
        REFERENCES public.users (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.notifications IS
    'User notification inbox for order status, payments, and marketing alerts.';

COMMENT ON COLUMN public.notifications.reference_type IS
    'Polymorphic reference entity name (e.g. orders, offers).';

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications (notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON public.notifications;
CREATE TRIGGER trg_notifications_updated_at
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();



-- ============================================================================
-- FILE: 022_create_reviews.sql
-- ============================================================================

-- ============================================================================
-- Migration: 022_create_reviews
-- Purpose: Customer ratings and feedback for orders and products.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    order_id UUID NOT NULL,
    restaurant_id UUID NOT NULL,
    product_id UUID,
    rating SMALLINT NOT NULL,
    comment TEXT,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT reviews_rating_range CHECK (rating >= 1 AND rating <= 5),

    CONSTRAINT fk_reviews_user_id
        FOREIGN KEY (user_id)
        REFERENCES public.users (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_reviews_order_id
        FOREIGN KEY (order_id)
        REFERENCES public.orders (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_reviews_restaurant_id
        FOREIGN KEY (restaurant_id)
        REFERENCES public.restaurants (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_reviews_product_id
        FOREIGN KEY (product_id)
        REFERENCES public.products (id)
        ON DELETE SET NULL
);

COMMENT ON TABLE public.reviews IS
    'Post-delivery customer reviews. product_id optional for restaurant-level ratings.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_user_order_product
    ON public.reviews (user_id, order_id, COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::uuid))
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_id ON public.reviews (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews (product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON public.reviews (rating);
CREATE INDEX IF NOT EXISTS idx_reviews_is_visible ON public.reviews (is_visible);

DROP TRIGGER IF EXISTS trg_reviews_updated_at ON public.reviews;
CREATE TRIGGER trg_reviews_updated_at
    BEFORE UPDATE ON public.reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();



-- ============================================================================
-- FILE: 023_create_favorites.sql
-- ============================================================================

-- ============================================================================
-- Migration: 023_create_favorites
-- Purpose: Customer saved/favorite products for quick reordering.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    product_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_favorites_user_id
        FOREIGN KEY (user_id)
        REFERENCES public.users (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_favorites_product_id
        FOREIGN KEY (product_id)
        REFERENCES public.products (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.favorites IS
    'User wishlist/favorites for frequently ordered menu items.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_user_product
    ON public.favorites (user_id, product_id);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites (user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_product_id ON public.favorites (product_id);



-- ============================================================================
-- FILE: 024_seed_admin_users.sql
-- ============================================================================

-- ============================================================================
-- Migration: 024_seed_admin_users
-- Purpose: Seed two admins with password login (no OTP).
--          Auth uses email+password (reliable). UI still asks for phone.
--          Email pattern: {10digit}@admin.getnear.app
--          Default password: GetNear@123
--
--   Farine Khan      — 8668879497
--   Darshan Salunkhe — 9552489313
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
    v_admin_role_id UUID;
    v_instance_id UUID;
    v_password TEXT := 'GetNear@123';
    v_farine_id UUID := 'a1000001-0001-4001-8001-000000000001';
    v_darshan_id UUID := 'a1000002-0002-4002-8002-000000000002';
    v_farine_email TEXT := '8668879497@admin.getnear.app';
    v_darshan_email TEXT := '9552489313@admin.getnear.app';
    v_farine_phone TEXT := '+918668879497';
    v_darshan_phone TEXT := '+919552489313';
BEGIN
    SELECT id INTO v_admin_role_id
    FROM public.roles
    WHERE slug = 'admin' AND deleted_at IS NULL
    LIMIT 1;

    IF v_admin_role_id IS NULL THEN
        RAISE EXCEPTION 'Admin role not found. Run 001_create_roles.sql first.';
    END IF;

    SELECT COALESCE(
        (SELECT id FROM auth.instances LIMIT 1),
        '00000000-0000-0000-0000-000000000000'::uuid
    ) INTO v_instance_id;

    -- Clear any previous broken seed for these ids/emails/phones
    DELETE FROM auth.identities
    WHERE user_id IN (v_farine_id, v_darshan_id)
       OR provider_id IN (v_farine_email, v_darshan_email, v_farine_phone, v_darshan_phone);

    DELETE FROM auth.users
    WHERE id IN (v_farine_id, v_darshan_id)
       OR email IN (v_farine_email, v_darshan_email)
       OR phone IN (v_farine_phone, v_darshan_phone);

    -- Farine Khan
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, phone, phone_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        is_super_admin, created_at, updated_at, is_sso_user, is_anonymous,
        confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
        v_farine_id, v_instance_id, 'authenticated', 'authenticated',
        v_farine_email, extensions.crypt(v_password, extensions.gen_salt('bf')),
        NOW(), v_farine_phone, NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Farine Khan"}'::jsonb,
        FALSE, NOW(), NOW(), FALSE, FALSE,
        '', '', '', ''
    );

    INSERT INTO auth.identities (
        id, provider_id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
    ) VALUES (
        v_farine_id, v_farine_email, v_farine_id,
        jsonb_build_object(
            'sub', v_farine_id::text,
            'email', v_farine_email,
            'email_verified', true,
            'phone', v_farine_phone
        ),
        'email', NOW(), NOW(), NOW()
    );

    IF EXISTS (
        SELECT 1 FROM public.users
        WHERE right(regexp_replace(phone, '\D', '', 'g'), 10) = '8668879497'
          AND deleted_at IS NULL
    ) THEN
        UPDATE public.users
        SET auth_user_uuid = v_farine_id, role_id = v_admin_role_id,
            full_name = 'Farine Khan', phone = '8668879497',
            is_active = TRUE, updated_at = NOW()
        WHERE right(regexp_replace(phone, '\D', '', 'g'), 10) = '8668879497'
          AND deleted_at IS NULL;
    ELSE
        INSERT INTO public.users (auth_user_uuid, role_id, full_name, phone, is_active)
        VALUES (v_farine_id, v_admin_role_id, 'Farine Khan', '8668879497', TRUE);
    END IF;

    -- Darshan Salunkhe
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, phone, phone_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        is_super_admin, created_at, updated_at, is_sso_user, is_anonymous,
        confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
        v_darshan_id, v_instance_id, 'authenticated', 'authenticated',
        v_darshan_email, extensions.crypt(v_password, extensions.gen_salt('bf')),
        NOW(), v_darshan_phone, NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Darshan Salunkhe"}'::jsonb,
        FALSE, NOW(), NOW(), FALSE, FALSE,
        '', '', '', ''
    );

    INSERT INTO auth.identities (
        id, provider_id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
    ) VALUES (
        v_darshan_id, v_darshan_email, v_darshan_id,
        jsonb_build_object(
            'sub', v_darshan_id::text,
            'email', v_darshan_email,
            'email_verified', true,
            'phone', v_darshan_phone
        ),
        'email', NOW(), NOW(), NOW()
    );

    IF EXISTS (
        SELECT 1 FROM public.users
        WHERE right(regexp_replace(phone, '\D', '', 'g'), 10) = '9552489313'
          AND deleted_at IS NULL
    ) THEN
        UPDATE public.users
        SET auth_user_uuid = v_darshan_id, role_id = v_admin_role_id,
            full_name = 'Darshan Salunkhe', phone = '9552489313',
            is_active = TRUE, updated_at = NOW()
        WHERE right(regexp_replace(phone, '\D', '', 'g'), 10) = '9552489313'
          AND deleted_at IS NULL;
    ELSE
        INSERT INTO public.users (auth_user_uuid, role_id, full_name, phone, is_active)
        VALUES (v_darshan_id, v_admin_role_id, 'Darshan Salunkhe', '9552489313', TRUE);
    END IF;
END $$;

COMMENT ON TABLE public.users IS
    'Seeded admins: phone in UI, password GetNear@123 (auth email {phone}@admin.getnear.app).';


-- ============================================================================
-- FILE: 025_restaurant_display_fields_and_rls.sql
-- ============================================================================

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
    ADD COLUMN IF NOT EXISTS icon_emoji VARCHAR(16) NOT NULL DEFAULT 'ðŸ½ï¸',
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
-- RLS: restaurants â€” public read active; admin write; owner limited update
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



-- ============================================================================
-- FILE: 026_fix_phone_link_policy.sql
-- ============================================================================

-- ============================================================================
-- Migration: 026_fix_phone_link_policy
-- Purpose: Allow authenticated users to claim a pre-seeded profile by phone
--          (admins/owners seeded before first OTP login).
-- ============================================================================

-- Replace overly broad update policy with phone-claim helper
DROP POLICY IF EXISTS users_update_auth_link ON public.users;

CREATE OR REPLACE FUNCTION public.claim_user_by_phone(p_phone TEXT)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_digits TEXT;
    v_row public.users;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    v_digits := right(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), 10);

    UPDATE public.users u
    SET
        auth_user_uuid = auth.uid(),
        phone = COALESCE(NULLIF(trim(u.phone), ''), v_digits),
        updated_at = NOW()
    WHERE u.deleted_at IS NULL
      AND right(regexp_replace(u.phone, '\D', '', 'g'), 10) = v_digits
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
        -- No pre-seeded profile: create customer if needed by caller
        RETURN NULL;
    END IF;

    RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_customer_profile(p_full_name TEXT, p_phone TEXT)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_digits TEXT;
    v_role_id UUID;
    v_row public.users;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT * INTO v_row
    FROM public.users
    WHERE auth_user_uuid = auth.uid()
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_row.id IS NOT NULL THEN
        RETURN v_row;
    END IF;

    v_digits := right(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), 10);

    SELECT id INTO v_role_id
    FROM public.roles
    WHERE slug = 'customer' AND deleted_at IS NULL
    LIMIT 1;

    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Customer role missing';
    END IF;

    INSERT INTO public.users (auth_user_uuid, role_id, full_name, phone, is_active)
    VALUES (
        auth.uid(),
        v_role_id,
        COALESCE(NULLIF(trim(p_full_name), ''), 'Customer'),
        COALESCE(NULLIF(v_digits, ''), '0000000000'),
        TRUE
    )
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_user_by_phone(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_customer_profile(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_role_slug() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_restaurant_owner_of(UUID) TO authenticated, anon;



-- ============================================================================
-- Table privileges for PostgREST (anon / authenticated)
-- Required after DROP SCHEMA — without this you get 42501 permission denied
-- ============================================================================
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;


-- ============================================================================
-- FILE: 027_grant_api_privileges.sql
-- ============================================================================

-- ============================================================================
-- Migration: 027_grant_api_privileges
-- Purpose: After DROP SCHEMA / recreate, PostgREST roles (anon, authenticated)
--          need table privileges. RLS still controls row access.
-- ============================================================================

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
    TO anon, authenticated, service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
    TO anon, authenticated, service_role;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public
    TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES
    TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES
    TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS
    TO anon, authenticated, service_role;


-- ============================================================================
-- FILE: 028_storage_buckets_and_policies.sql
-- ============================================================================

-- ============================================================================
-- Migration: 028_storage_buckets_and_policies
-- Purpose: Public buckets for restaurant banners and product photos.
--          Read: anyone. Write: see 029 (admin / owner only).
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'restaurant-assets',
    'restaurant-assets',
    TRUE,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'product-images',
    'product-images',
    TRUE,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  )
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read only (customers need to see images)
DROP POLICY IF EXISTS restaurant_assets_public_read ON storage.objects;
CREATE POLICY restaurant_assets_public_read
  ON storage.objects FOR SELECT
  USING (bucket_id = 'restaurant-assets');

DROP POLICY IF EXISTS product_images_public_read ON storage.objects;
CREATE POLICY product_images_public_read
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');


-- ============================================================================
-- FILE: 029_restrict_storage_and_user_update.sql
-- ============================================================================

-- ============================================================================
-- Migration: 029_restrict_storage_and_user_update
-- Purpose:
--   1. Only admin / restaurant_owner can upload or change images
--   2. Remove dangerous users UPDATE policy (USING TRUE)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Storage: drop open "any authenticated" write policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS restaurant_assets_auth_upload ON storage.objects;
DROP POLICY IF EXISTS restaurant_assets_auth_update ON storage.objects;
DROP POLICY IF EXISTS restaurant_assets_auth_delete ON storage.objects;
DROP POLICY IF EXISTS product_images_auth_upload ON storage.objects;
DROP POLICY IF EXISTS product_images_auth_update ON storage.objects;
DROP POLICY IF EXISTS product_images_auth_delete ON storage.objects;

-- Restaurant banners: admin only (owners don't create restaurants)
CREATE POLICY restaurant_assets_admin_upload
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'restaurant-assets'
    AND public.is_admin()
  );

CREATE POLICY restaurant_assets_admin_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'restaurant-assets'
    AND public.is_admin()
  );

CREATE POLICY restaurant_assets_admin_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'restaurant-assets'
    AND public.is_admin()
  );

-- Menu photos: admin or restaurant owner
CREATE POLICY product_images_staff_upload
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (
      public.is_admin()
      OR public.current_role_slug() = 'restaurant_owner'
    )
  );

CREATE POLICY product_images_staff_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (
      public.is_admin()
      OR public.current_role_slug() = 'restaurant_owner'
    )
  );

CREATE POLICY product_images_staff_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (
      public.is_admin()
      OR public.current_role_slug() = 'restaurant_owner'
    )
  );

-- Keep public read (customer app needs to display images)
-- restaurant_assets_public_read / product_images_public_read unchanged

-- ---------------------------------------------------------------------------
-- users: remove open UPDATE policy
-- Profile linking uses SECURITY DEFINER RPCs (claim_user_by_phone, etc.)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS users_update_auth_link ON public.users;

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

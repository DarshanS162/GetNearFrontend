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

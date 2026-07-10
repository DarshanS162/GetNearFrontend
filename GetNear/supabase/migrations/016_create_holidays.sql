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

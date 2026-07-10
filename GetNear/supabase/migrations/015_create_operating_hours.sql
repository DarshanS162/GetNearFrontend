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

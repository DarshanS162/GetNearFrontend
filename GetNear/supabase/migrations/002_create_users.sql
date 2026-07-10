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

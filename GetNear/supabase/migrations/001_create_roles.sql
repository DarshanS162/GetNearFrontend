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

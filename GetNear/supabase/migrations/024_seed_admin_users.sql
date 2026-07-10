-- ============================================================================
-- Migration: 024_seed_admin_users
-- Purpose: Seed two platform admin accounts (no restaurants).
--          Run after all schema migrations (000–023).
--
-- Admins:
--   Farine Khan      — 8668879497
--   Darshan Salunkhe — 9552489313
--
-- Note: auth.users rows are required for Supabase Phone OTP login.
--       public.users maps auth identity to the admin role.
-- ============================================================================

DO $$
DECLARE
    v_instance_id UUID := '00000000-0000-0000-0000-000000000000';
    v_admin_role_id UUID;
    v_farine_auth_id UUID := 'a1000001-0001-4001-8001-000000000001';
    v_darshan_auth_id UUID := 'a1000002-0002-4002-8002-000000000002';
    v_farine_phone TEXT := '918668879497';
    v_darshan_phone TEXT := '919552489313';
BEGIN
    SELECT id INTO v_admin_role_id
    FROM public.roles
    WHERE slug = 'admin' AND deleted_at IS NULL
    LIMIT 1;

    IF v_admin_role_id IS NULL THEN
        RAISE EXCEPTION 'Admin role not found. Run 001_create_roles.sql first.';
    END IF;

    -- -------------------------------------------------------------------------
    -- Farine Khan — 8668879497
    -- -------------------------------------------------------------------------
    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        phone,
        phone_confirmed_at,
        confirmation_sent_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        created_at,
        updated_at,
        is_sso_user,
        is_anonymous
    )
    VALUES (
        v_farine_auth_id,
        v_instance_id,
        'authenticated',
        'authenticated',
        NULL,
        '',
        NULL,
        v_farine_phone,
        NOW(),
        NOW(),
        '{"provider":"phone","providers":["phone"]}'::jsonb,
        '{"full_name":"Farine Khan"}'::jsonb,
        FALSE,
        NOW(),
        NOW(),
        FALSE,
        FALSE
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO auth.identities (
        id,
        provider_id,
        user_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
    )
    VALUES (
        v_farine_auth_id,
        v_farine_phone,
        v_farine_auth_id,
        jsonb_build_object(
            'sub', v_farine_auth_id::text,
            'phone', v_farine_phone,
            'phone_verified', true
        ),
        'phone',
        NOW(),
        NOW(),
        NOW()
    )
    ON CONFLICT (provider_id, provider) DO NOTHING;

    INSERT INTO public.users (
        auth_user_uuid,
        role_id,
        full_name,
        phone,
        is_active
    )
    SELECT
        v_farine_auth_id,
        v_admin_role_id,
        'Farine Khan',
        '8668879497',
        TRUE
    WHERE NOT EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.phone = '8668879497' AND u.deleted_at IS NULL
    );

    -- -------------------------------------------------------------------------
    -- Darshan Salunkhe — 9552489313
    -- -------------------------------------------------------------------------
    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        phone,
        phone_confirmed_at,
        confirmation_sent_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        created_at,
        updated_at,
        is_sso_user,
        is_anonymous
    )
    VALUES (
        v_darshan_auth_id,
        v_instance_id,
        'authenticated',
        'authenticated',
        NULL,
        '',
        NULL,
        v_darshan_phone,
        NOW(),
        NOW(),
        '{"provider":"phone","providers":["phone"]}'::jsonb,
        '{"full_name":"Darshan Salunkhe"}'::jsonb,
        FALSE,
        NOW(),
        NOW(),
        FALSE,
        FALSE
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO auth.identities (
        id,
        provider_id,
        user_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
    )
    VALUES (
        v_darshan_auth_id,
        v_darshan_phone,
        v_darshan_auth_id,
        jsonb_build_object(
            'sub', v_darshan_auth_id::text,
            'phone', v_darshan_phone,
            'phone_verified', true
        ),
        'phone',
        NOW(),
        NOW(),
        NOW()
    )
    ON CONFLICT (provider_id, provider) DO NOTHING;

    INSERT INTO public.users (
        auth_user_uuid,
        role_id,
        full_name,
        phone,
        is_active
    )
    SELECT
        v_darshan_auth_id,
        v_admin_role_id,
        'Darshan Salunkhe',
        '9552489313',
        TRUE
    WHERE NOT EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.phone = '9552489313' AND u.deleted_at IS NULL
    );

END $$;

COMMENT ON TABLE public.users IS
    'Application user profiles. Seeded admins: Farine Khan (8668879497), Darshan Salunkhe (9552489313).';

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

-- Supabase hosts pgcrypto under the extensions schema
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

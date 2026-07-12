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

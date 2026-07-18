-- ============================================================================
-- Migration: 032_partner_application_flow
-- Purpose: Partner self-registration + admin approve/reject RPCs.
-- ============================================================================

-- Allow rejected applications
ALTER TABLE public.restaurants
    DROP CONSTRAINT IF EXISTS restaurants_business_status_check;

ALTER TABLE public.restaurants
    ADD CONSTRAINT restaurants_business_status_check CHECK (
        business_status IN (
            'active',
            'inactive',
            'suspended',
            'pending_approval',
            'rejected'
        )
    );

ALTER TABLE public.restaurants
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ---------------------------------------------------------------------------
-- Submit partner application (authenticated user)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_partner_application(
    p_restaurant_name TEXT,
    p_owner_name TEXT,
    p_phone TEXT,
    p_location TEXT DEFAULT NULL,
    p_cuisine TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_gst_number TEXT DEFAULT NULL,
    p_fssai_number TEXT DEFAULT NULL,
    p_contact_email TEXT DEFAULT NULL
)
RETURNS public.restaurants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_role_owner UUID;
    v_digits TEXT;
    v_slug TEXT;
    v_base_slug TEXT;
    v_attempt INT := 1;
    v_existing UUID;
    v_row public.restaurants;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Login required to apply';
    END IF;

    v_digits := right(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), 10);
    IF char_length(v_digits) <> 10 THEN
        RAISE EXCEPTION 'Valid 10-digit mobile number is required';
    END IF;

    IF char_length(trim(COALESCE(p_restaurant_name, ''))) < 2 THEN
        RAISE EXCEPTION 'Restaurant name is required';
    END IF;

    IF char_length(trim(COALESCE(p_owner_name, ''))) < 2 THEN
        RAISE EXCEPTION 'Owner name is required';
    END IF;

    -- Ensure app user row exists
    SELECT id INTO v_user_id FROM public.users
     WHERE auth_user_uuid = auth.uid() AND deleted_at IS NULL
     LIMIT 1;

    IF v_user_id IS NULL THEN
        SELECT id INTO v_role_owner FROM public.roles
         WHERE slug = 'customer' AND deleted_at IS NULL LIMIT 1;

        INSERT INTO public.users (auth_user_uuid, role_id, full_name, phone, is_active)
        VALUES (
            auth.uid(),
            v_role_owner,
            trim(p_owner_name),
            v_digits,
            TRUE
        )
        RETURNING id INTO v_user_id;
    ELSE
        UPDATE public.users
           SET full_name = COALESCE(NULLIF(trim(p_owner_name), ''), full_name),
               phone = COALESCE(NULLIF(v_digits, ''), phone),
               updated_at = NOW()
         WHERE id = v_user_id;
    END IF;

    -- Block duplicate open applications / live stores for same owner
    SELECT id INTO v_existing
      FROM public.restaurants
     WHERE owner_id = v_user_id
       AND deleted_at IS NULL
       AND business_status IN ('pending_approval', 'active')
     LIMIT 1;

    IF v_existing IS NOT NULL THEN
        RAISE EXCEPTION 'You already have a restaurant application or active store';
    END IF;

    SELECT id INTO v_role_owner FROM public.roles
     WHERE slug = 'restaurant_owner' AND deleted_at IS NULL LIMIT 1;

    IF v_role_owner IS NULL THEN
        RAISE EXCEPTION 'restaurant_owner role missing';
    END IF;

    UPDATE public.users
       SET role_id = v_role_owner, updated_at = NOW()
     WHERE id = v_user_id;

    v_base_slug := lower(regexp_replace(trim(p_restaurant_name), '[^a-zA-Z0-9]+', '-', 'g'));
    v_base_slug := trim(both '-' from v_base_slug);
    IF v_base_slug = '' THEN
        v_base_slug := 'restaurant';
    END IF;
    v_slug := v_base_slug;

    LOOP
        BEGIN
            INSERT INTO public.restaurants (
                owner_id,
                name,
                slug,
                description,
                cuisine_type,
                location_label,
                contact_phone,
                contact_email,
                gst_number,
                fssai_number,
                business_status,
                is_active
            ) VALUES (
                v_user_id,
                trim(p_restaurant_name),
                v_slug,
                NULLIF(trim(COALESCE(p_description, '')), ''),
                NULLIF(trim(COALESCE(p_cuisine, '')), ''),
                NULLIF(trim(COALESCE(p_location, '')), ''),
                v_digits,
                NULLIF(trim(COALESCE(p_contact_email, '')), ''),
                NULLIF(trim(COALESCE(p_gst_number, '')), ''),
                NULLIF(trim(COALESCE(p_fssai_number, '')), ''),
                'pending_approval',
                FALSE
            )
            RETURNING * INTO v_row;
            EXIT;
        EXCEPTION WHEN unique_violation THEN
            v_attempt := v_attempt + 1;
            IF v_attempt > 20 THEN
                RAISE EXCEPTION 'Could not create unique restaurant slug';
            END IF;
            v_slug := v_base_slug || '-' || v_attempt;
        END;
    END LOOP;

    RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin approve
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_partner_application(p_restaurant_id UUID)
RETURNS public.restaurants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row public.restaurants;
    v_role_owner UUID;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin only';
    END IF;

    UPDATE public.restaurants
       SET business_status = 'active',
           is_active = TRUE,
           rejection_reason = NULL,
           updated_at = NOW()
     WHERE id = p_restaurant_id
       AND deleted_at IS NULL
       AND business_status = 'pending_approval'
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
        RAISE EXCEPTION 'Pending application not found';
    END IF;

    SELECT id INTO v_role_owner FROM public.roles
     WHERE slug = 'restaurant_owner' AND deleted_at IS NULL LIMIT 1;

    IF v_row.owner_id IS NOT NULL AND v_role_owner IS NOT NULL THEN
        UPDATE public.users
           SET role_id = v_role_owner, updated_at = NOW()
         WHERE id = v_row.owner_id;
    END IF;

    RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin reject
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_partner_application(
    p_restaurant_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS public.restaurants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row public.restaurants;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin only';
    END IF;

    UPDATE public.restaurants
       SET business_status = 'rejected',
           is_active = FALSE,
           rejection_reason = NULLIF(trim(COALESCE(p_reason, '')), ''),
           updated_at = NOW()
     WHERE id = p_restaurant_id
       AND deleted_at IS NULL
       AND business_status = 'pending_approval'
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
        RAISE EXCEPTION 'Pending application not found';
    END IF;

    RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_partner_application(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.approve_partner_application(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_partner_application(UUID, TEXT) TO authenticated;

-- Refresh PostgREST schema cache so rpc() finds the new functions immediately
NOTIFY pgrst, 'reload schema';

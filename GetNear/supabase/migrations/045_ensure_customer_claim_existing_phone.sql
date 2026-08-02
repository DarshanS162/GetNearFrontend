-- ============================================================================
-- 045: ensure_customer_profile — if phone already exists, claim it (don't fail signup)
-- ============================================================================

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

  -- Phone already in users (e.g. admin-created) → link this login
  IF char_length(v_digits) = 10 THEN
    UPDATE public.users u
    SET
      auth_user_uuid = auth.uid(),
      full_name = COALESCE(NULLIF(trim(p_full_name), ''), u.full_name),
      phone = v_digits,
      updated_at = NOW()
    WHERE u.deleted_at IS NULL
      AND right(regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g'), 10) = v_digits
    RETURNING * INTO v_row;

    IF v_row.id IS NOT NULL THEN
      RETURN v_row;
    END IF;
  END IF;

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

ALTER FUNCTION public.ensure_customer_profile(text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.ensure_customer_profile(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_customer_profile(text, text) TO authenticated;

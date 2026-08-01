-- ============================================================================
-- 042: Permanent delete customers even with orders (anonymize + soft-delete)
-- Hard-deletes when no history; otherwise scrubs PII and soft-deletes so list is clear.
-- ============================================================================

-- Must drop first: cannot change return type void → text with CREATE OR REPLACE
DROP FUNCTION IF EXISTS public.admin_delete_customer(uuid);

CREATE OR REPLACE FUNCTION public.admin_delete_customer(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_has_history boolean := false;
  v_ghost_phone text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  SELECT r.slug INTO v_role
  FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  WHERE u.id = p_user_id
    AND u.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  IF v_role IS DISTINCT FROM 'customer' THEN
    RAISE EXCEPTION 'Only customer accounts can be permanently deleted here';
  END IF;

  v_has_history := EXISTS (
    SELECT 1 FROM public.orders WHERE customer_id = p_user_id LIMIT 1
  ) OR EXISTS (
    SELECT 1 FROM public.referrals
    WHERE referrer_user_id = p_user_id OR referred_user_id = p_user_id
    LIMIT 1
  ) OR EXISTS (
    SELECT 1 FROM public.coupon_usages WHERE user_id = p_user_id LIMIT 1
  );

  -- Free phone uniqueness for future signups (partial unique index ignores deleted_at)
  UPDATE public.users
  SET referred_by_user_id = NULL
  WHERE referred_by_user_id = p_user_id;

  IF NOT v_has_history THEN
    DELETE FROM public.users WHERE id = p_user_id;
    RETURN 'deleted';
  END IF;

  -- Keep FK history (orders etc.) but remove identifiable customer data
  v_ghost_phone := 'del' || replace(p_user_id::text, '-', '');

  UPDATE public.users
  SET
    full_name = 'Deleted customer',
    phone = left(v_ghost_phone, 20),
    email = NULL,
    profile_image = NULL,
    is_active = false,
    referral_code = NULL,
    referred_by_user_id = NULL,
    deleted_at = now(),
    updated_at = now()
  WHERE id = p_user_id;

  RETURN 'anonymized';
END;
$$;

ALTER FUNCTION public.admin_delete_customer(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.admin_delete_customer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_customer(uuid) TO authenticated;

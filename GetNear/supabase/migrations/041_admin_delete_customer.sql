-- ============================================================================
-- 041: Admin can permanently delete customers (or disable via app)
-- ============================================================================

-- Allow admins to hard-delete user rows
DROP POLICY IF EXISTS users_delete_admin ON public.users;
CREATE POLICY users_delete_admin
  ON public.users
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Safe permanent delete for customer-role users only
CREATE OR REPLACE FUNCTION public.admin_delete_customer(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_orders int;
  v_referrals int;
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
  WHERE u.id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  IF v_role IS DISTINCT FROM 'customer' THEN
    RAISE EXCEPTION 'Only customer accounts can be permanently deleted here';
  END IF;

  SELECT COUNT(*) INTO v_orders
  FROM public.orders
  WHERE customer_id = p_user_id;

  IF v_orders > 0 THEN
    RAISE EXCEPTION
      'This customer has % order(s). Disable the account instead of deleting permanently.',
      v_orders;
  END IF;

  SELECT COUNT(*) INTO v_referrals
  FROM public.referrals
  WHERE referrer_user_id = p_user_id OR referred_user_id = p_user_id;

  IF v_referrals > 0 THEN
    RAISE EXCEPTION
      'This customer is linked to referral records. Disable the account instead of deleting permanently.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.coupon_usages WHERE user_id = p_user_id LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'This customer has coupon usage history. Disable the account instead of deleting permanently.';
  END IF;

  -- Clear soft FKs that would block delete
  UPDATE public.users
  SET referred_by_user_id = NULL
  WHERE referred_by_user_id = p_user_id;

  DELETE FROM public.users WHERE id = p_user_id;
END;
$$;

ALTER FUNCTION public.admin_delete_customer(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.admin_delete_customer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_customer(uuid) TO authenticated;

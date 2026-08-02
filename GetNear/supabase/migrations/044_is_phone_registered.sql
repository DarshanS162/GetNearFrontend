-- ============================================================================
-- 044: Public check — is this phone already a GetNear user?
-- Used so login OTP is only sent to registered numbers.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_phone_registered(p_phone text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits text;
BEGIN
  v_digits := right(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), 10);
  IF char_length(v_digits) <> 10 THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.deleted_at IS NULL
      AND right(regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g'), 10) = v_digits
  );
END;
$$;

ALTER FUNCTION public.is_phone_registered(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_phone_registered(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_phone_registered(text) TO anon, authenticated;

COMMENT ON FUNCTION public.is_phone_registered(text) IS
  'Returns true if an active (non-deleted) users row exists for the phone. Safe for anon pre-login checks.';

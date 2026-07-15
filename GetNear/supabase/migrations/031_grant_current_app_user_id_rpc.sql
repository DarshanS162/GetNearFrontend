-- ============================================================================
-- Migration: 031_grant_current_app_user_id_rpc
-- Purpose: Ensure current_app_user_id() is callable from the client (PostgREST RPC)
--          so address/order writes can resolve the RLS user id reliably.
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.claim_user_by_phone(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_customer_profile(TEXT, TEXT) TO authenticated;

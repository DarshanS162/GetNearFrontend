/**
 * Resolve the public.users id that RLS policies use (current_app_user_id).
 * Repairs a missing profile link when possible.
 */
export async function resolveAppUserId(client, { fullName, phone } = {}) {
  const { data: existing, error: existingError } = await client.rpc(
    'current_app_user_id',
  );
  if (existingError) {
    throw new Error(existingError.message || 'Could not resolve user profile');
  }
  if (existing) return existing;

  const {
    data: { session },
  } = await client.auth.getSession();
  const authUser = session?.user;
  if (!authUser) {
    throw new Error('Login required. Please sign in again.');
  }

  const phoneHint = phone || authUser.phone || '';
  const nameHint =
    fullName || authUser.user_metadata?.full_name || 'Customer';

  const { error: claimError } = await client.rpc('claim_user_by_phone', {
    p_phone: phoneHint,
  });
  if (claimError) {
    throw new Error(claimError.message || 'Could not link your profile');
  }

  const { data: afterClaim } = await client.rpc('current_app_user_id');
  if (afterClaim) return afterClaim;

  // Last resort: create customer row (orphaned auth session after partial signup)
  const { error: ensureError } = await client.rpc('ensure_customer_profile', {
    p_full_name: nameHint,
    p_phone: phoneHint,
  });
  if (ensureError) {
    throw new Error(
      ensureError.message ||
        'Could not link your profile. Please logout and login again.',
    );
  }

  const { data: repaired, error: repairedError } = await client.rpc(
    'current_app_user_id',
  );
  if (repairedError) {
    throw new Error(repairedError.message || 'Could not resolve user profile');
  }
  if (!repaired) {
    throw new Error(
      'Your profile is not linked to this login. Please logout and login again.',
    );
  }

  return repaired;
}

export function mapRlsError(err) {
  const message = err?.message || String(err || '');
  if (/row-level security|rls/i.test(message)) {
    return new Error(
      'Permission denied for this action. Please logout and login again, then retry.',
    );
  }
  if (/outside the delivery area|delivery zone|not deliver/i.test(message)) {
    return new Error(
      "Sorry, this store doesn't deliver to your selected address. Try a different address or restaurant nearby.",
    );
  }
  if (/store is currently closed|not accepting orders|closed right now/i.test(message)) {
    return new Error(
      'This store is closed right now. Please try again when it opens.',
    );
  }
  if (/delivery code does not match|4-digit delivery code|Delivery code is missing/i.test(message)) {
    return new Error(message);
  }
  if (/Use advance_order_status|customer_cancel_order/i.test(message)) {
    return new Error(
      'Order status update is blocked by the database. Run migration 038_fix_order_status_updates.sql in Supabase, then try again.',
    );
  }
  return err instanceof Error ? err : new Error(message);
}

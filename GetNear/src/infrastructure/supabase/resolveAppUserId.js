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
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    throw new Error('Login required. Please sign in again.');
  }

  const phoneHint = phone || user.phone || '';
  const nameHint =
    fullName || user.user_metadata?.full_name || 'Customer';

  // Claim pre-seeded owner/admin rows, or create a customer profile.
  await client.rpc('claim_user_by_phone', { p_phone: phoneHint });
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
  return err instanceof Error ? err : new Error(message);
}

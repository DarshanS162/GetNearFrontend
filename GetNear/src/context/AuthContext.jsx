import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { IS_SIGNUP, PENDING_NAME } from '../lib/authKeys';
import {
  getPostLoginPath,
  normalizePhone,
  toE164India,
} from '../lib/utils';

const AuthContext = createContext(null);

async function fetchProfileByAuthId(authUserId) {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, phone, role_id, auth_user_uuid, roles(slug, name)')
    .eq('auth_user_uuid', authUserId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function isPhoneRegistered(phone) {
  const { data, error } = await supabase.rpc('is_phone_registered', {
    p_phone: phone || '',
  });
  if (error) throw error;
  return Boolean(data);
}

/** login → must exist; signup → must be new. Returns error message or null. */
async function phoneGate(phone, mode) {
  const registered = await isPhoneRegistered(phone);
  if (mode === 'login' && !registered) {
    return 'No account found for this number. Please create an account first.';
  }
  if (mode === 'signup' && registered) {
    return 'This number is already registered. Please log in.';
  }
  return null;
}

async function loadAppUser(authUser, phoneHint, { createIfMissing = false } = {}) {
  const phone =
    toE164India(phoneHint || authUser.phone) || phoneHint || authUser.phone || '';

  const { data: claimed, error: claimError } = await supabase.rpc(
    'claim_user_by_phone',
    { p_phone: phone || authUser.phone || '' },
  );
  if (claimError) console.warn('claim_user_by_phone:', claimError.message);

  let row = claimed || (await fetchProfileByAuthId(authUser.id));

  if (!row && createIfMissing) {
    const pendingName = sessionStorage.getItem(PENDING_NAME);
    const { data: created, error: createError } = await supabase.rpc(
      'ensure_customer_profile',
      {
        p_full_name:
          pendingName || authUser.user_metadata?.full_name || 'Customer',
        p_phone: phone || authUser.phone || '',
      },
    );
    if (createError) console.warn('ensure_customer_profile:', createError.message);
    else row = created;
  }

  // Reload with roles join (RPC rows often omit nested roles)
  row = (await fetchProfileByAuthId(authUser.id)) || row;
  if (!row) return null;

  const roleRelation = row.roles;
  let role =
    (Array.isArray(roleRelation) ? roleRelation[0]?.slug : roleRelation?.slug) ||
    row.role_slug ||
    'customer';

  let restaurantId = null;
  const { data: owned } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', row.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (owned?.id) {
    restaurantId = owned.id;
    if (role === 'customer') role = 'restaurant_owner';
  }

  return {
    id: row.id,
    authUserId: authUser.id,
    role,
    phone: normalizePhone(row.phone),
    fullName: row.full_name || 'User',
    restaurantId,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const fail = (msg) => {
    setAuthError(msg);
    return { error: msg };
  };

  const syncSession = useCallback(async (session) => {
    if (!session?.user) {
      setUser(null);
      return null;
    }

    const isSignup = sessionStorage.getItem(IS_SIGNUP) === '1';
    try {
      const profile = await loadAppUser(session.user, session.user.phone, {
        createIfMissing: isSignup,
      });

      if (!profile) {
        await supabase.auth.signOut();
        setUser(null);
        setAuthError(
          isSignup
            ? 'Could not create your account. Please try again.'
            : 'No account found for this number. Please sign up first.',
        );
        return null;
      }

      setUser(profile);
      return profile;
    } catch (err) {
      console.error(err);
      setAuthError(err.message || 'Failed to load profile');
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      syncSession(data.session).finally(() => {
        if (mounted) setLoading(false);
      });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSession(session);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [syncSession]);

  /** @param {'login' | 'signup'} [mode] */
  async function sendOtp(phone, { mode = 'login' } = {}) {
    setAuthError('');
    const e164 = toE164India(phone);
    if (!e164) return fail('Enter a valid 10-digit mobile number');

    try {
      const gateError = await phoneGate(e164, mode);
      if (gateError) return fail(gateError);
    } catch (err) {
      return fail(err.message || 'Could not verify this number');
    }

    const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
    if (error) return fail(error.message);
    return { phone: e164 };
  }

  async function verifyOtp(phone, token) {
    setAuthError('');
    const e164 = toE164India(phone) || phone;
    const { data, error } = await supabase.auth.verifyOtp({
      phone: e164,
      token: String(token).trim(),
      type: 'sms',
    });
    if (error) return fail(error.message);

    const profile = await syncSession(data.session);
    if (!profile) {
      return fail(
        sessionStorage.getItem(IS_SIGNUP) === '1'
          ? 'Could not create your account. Please try again.'
          : 'No account found for this number. Please sign up first.',
      );
    }
    return { user: profile, session: data.session };
  }

  async function loginWithPassword(phone, password) {
    setAuthError('');
    const digits = normalizePhone(phone);
    if (digits.length !== 10) return fail('Enter a valid 10-digit mobile number');
    if (!password) return fail('Enter your password');

    try {
      const gateError = await phoneGate(digits, 'login');
      if (gateError) return fail(gateError);
    } catch (err) {
      return fail(err.message || 'Could not verify this number');
    }

    // Admins: {phone}@admin.getnear.app · Customers: phone + password
    let { data, error } = await supabase.auth.signInWithPassword({
      email: `${digits}@admin.getnear.app`,
      password,
    });
    if (error) {
      ({ data, error } = await supabase.auth.signInWithPassword({
        phone: toE164India(phone),
        password,
      }));
    }
    if (error) {
      return fail(
        /invalid login credentials/i.test(error.message)
          ? 'Wrong password, or set a password via Sign up / OTP first.'
          : error.message,
      );
    }

    const profile = await syncSession(data.session);
    if (!profile) {
      return fail('No account found for this number. Please sign up first.');
    }
    return { user: profile, session: data.session };
  }

  async function savePassword(password) {
    setAuthError('');
    if (!password || password.length < 6) {
      return fail('Password must be at least 6 characters');
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return fail(error.message);
    return { ok: true };
  }

  async function updateProfile({ fullName, phone }) {
    setAuthError('');
    if (!user?.id) return fail('Login required');

    const name = String(fullName || '').trim();
    const digits = normalizePhone(phone);
    if (name.length < 2) return fail('Enter your full name');
    if (digits.length !== 10) return fail('Enter a valid 10-digit mobile number');

    const { data, error } = await supabase
      .from('users')
      .update({
        full_name: name,
        phone: digits,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .is('deleted_at', null)
      .select('id, full_name, phone')
      .single();

    if (error) {
      return fail(
        error.code === '23505'
          ? 'This phone number is already in use'
          : error.message || 'Could not update profile',
      );
    }

    setUser((prev) =>
      prev
        ? {
            ...prev,
            fullName: data.full_name || name,
            phone: normalizePhone(data.phone || digits),
          }
        : prev,
    );
    return { ok: true, user: data };
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isRestaurantOwner = user?.role === 'restaurant_owner';

  const value = useMemo(
    () => ({
      user,
      loading,
      authError,
      setAuthError,
      isAdmin,
      isRestaurantOwner,
      isAuthenticated: Boolean(user),
      sendOtp,
      verifyOtp,
      loginWithPassword,
      savePassword,
      updateProfile,
      logout,
      syncSession,
      normalizePhone,
      toE164India,
      getPostLoginPath,
    }),
    [user, loading, authError, isAdmin, isRestaurantOwner],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { getPostLoginPath, normalizePhone, toE164India };

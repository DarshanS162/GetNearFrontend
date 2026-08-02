import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { IS_SIGNUP, PENDING_NAME } from '../lib/authKeys';
import {
  getPostLoginPath,
  normalizePhone,
  toE164India,
} from '../lib/utils';

const AuthContext = createContext(null);

function customerEmail(digits) {
  return `${digits}@customer.getnear.app`;
}

function adminEmail(digits) {
  return `${digits}@admin.getnear.app`;
}

async function fetchProfile(authUserId) {
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

async function toAppUser(authUser, row) {
  const roleRelation = row.roles;
  let role =
    (Array.isArray(roleRelation) ? roleRelation[0]?.slug : roleRelation?.slug) ||
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

/**
 * After SMS verify on signup: claim-or-create public.users row.
 * Throws on failure so the UI can show the real error.
 */
async function ensureSignupProfile(authUser, phoneHint) {
  const phone =
    toE164India(phoneHint || authUser.phone) ||
    phoneHint ||
    authUser.phone ||
    '';
  const fullName =
    sessionStorage.getItem(PENDING_NAME) ||
    authUser.user_metadata?.full_name ||
    'Customer';

  await supabase.rpc('claim_user_by_phone', { p_phone: String(phone) });

  let row = await fetchProfile(authUser.id);
  if (row) return row;

  const { data: created, error } = await supabase.rpc('ensure_customer_profile', {
    p_full_name: fullName,
    p_phone: String(phone),
  });
  if (error) throw new Error(error.message);

  row = (await fetchProfile(authUser.id)) || created;
  if (!row) throw new Error('Could not create your account. Please try again.');
  return row;
}

async function loadAppUser(authUser, phoneHint, { createIfMissing = false } = {}) {
  const phone =
    toE164India(phoneHint || authUser.phone) ||
    phoneHint ||
    authUser.phone ||
    authUser.user_metadata?.phone ||
    '';

  if (createIfMissing) {
    const row = await ensureSignupProfile(authUser, phone);
    return toAppUser(authUser, row);
  }

  const { data: claimed, error: claimError } = await supabase.rpc(
    'claim_user_by_phone',
    { p_phone: String(phone || '') },
  );
  if (claimError) throw new Error(claimError.message);

  const row = claimed || (await fetchProfile(authUser.id));
  if (!row) return null;
  return toAppUser(authUser, row);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const syncLock = useRef(Promise.resolve());
  const authBusy = useRef(false);

  const fail = (msg) => {
    setAuthError(msg);
    return { error: msg };
  };

  const syncSession = useCallback(async (session, opts = {}) => {
    const run = async () => {
      if (!session?.user) {
        setUser(null);
        return null;
      }

      const createIfMissing =
        opts.createIfMissing ?? sessionStorage.getItem(IS_SIGNUP) === '1';
      const phoneHint =
        opts.phoneHint ||
        session.user.phone ||
        session.user.user_metadata?.phone;

      try {
        const profile = await loadAppUser(session.user, phoneHint, {
          createIfMissing,
        });
        if (!profile) {
          setUser(null);
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
    };

    const next = syncLock.current.then(run, run);
    syncLock.current = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
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
      if (authBusy.current) return;
      setTimeout(() => {
        if (mounted && !authBusy.current) syncSession(session);
      }, 0);
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
      const registered = await isPhoneRegistered(e164);
      if (mode === 'login' && !registered) {
        return fail(
          'No account found for this number. Please create an account first.',
        );
      }
      if (mode === 'signup' && registered) {
        return fail('This number is already registered. Please log in.');
      }
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
    const isSignup = sessionStorage.getItem(IS_SIGNUP) === '1';

    authBusy.current = true;
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: e164,
        token: String(token).trim(),
        type: 'sms',
      });
      if (error) return fail(error.message);
      if (!data.session?.user) {
        return fail('Could not verify OTP. Please try again.');
      }

      // Signup: create public.users as soon as SMS is verified
      const profile = await syncSession(data.session, {
        createIfMissing: isSignup,
        phoneHint: e164,
      });

      if (!profile) {
        return fail(
          isSignup
            ? authError || 'Could not create your account. Please try again.'
            : 'No account found for this number. Please sign up first.',
        );
      }

      return { user: profile, session: data.session };
    } catch (err) {
      return fail(err.message || 'Could not verify OTP');
    } finally {
      authBusy.current = false;
    }
  }

  async function loginWithPassword(phone, password) {
    setAuthError('');
    const digits = normalizePhone(phone);
    if (digits.length !== 10) return fail('Enter a valid 10-digit mobile number');
    if (!password) return fail('Enter your password');

    try {
      if (!(await isPhoneRegistered(digits))) {
        return fail(
          'No account found for this number. Please create an account first.',
        );
      }
    } catch (err) {
      return fail(err.message || 'Could not verify this number');
    }

    authBusy.current = true;
    try {
      const attempts = [
        { email: adminEmail(digits), password },
        { email: customerEmail(digits), password },
        { phone: toE164India(phone), password },
      ];

      let session = null;
      let lastError = null;
      for (const creds of attempts) {
        const { data, error } = await supabase.auth.signInWithPassword(creds);
        if (!error && data.session) {
          session = data.session;
          break;
        }
        lastError = error;
      }

      if (!session) {
        return fail(
          /invalid login credentials/i.test(lastError?.message || '')
            ? 'Wrong password. Try again, or use Login with OTP.'
            : lastError?.message || 'Could not sign in',
        );
      }

      const profile = await syncSession(session, {
        createIfMissing: false,
        phoneHint: digits,
      });
      if (!profile) {
        return fail('No account found for this number. Please sign up first.');
      }
      return { user: profile, session };
    } finally {
      authBusy.current = false;
    }
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
      isAuthenticated: Boolean(user?.id),
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
    [user, loading, authError, isAdmin, isRestaurantOwner, syncSession],
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

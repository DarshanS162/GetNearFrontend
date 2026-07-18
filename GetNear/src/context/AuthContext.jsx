import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PENDING_NAME } from '../lib/authKeys';
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

async function claimAndLoadProfile(authUser, phoneHint) {
  const phone = toE164India(phoneHint || authUser.phone) || phoneHint || authUser.phone;

  const { data: claimed, error: claimError } = await supabase.rpc('claim_user_by_phone', {
    p_phone: phone || authUser.phone || '',
  });

  if (claimError) {
    console.warn('claim_user_by_phone:', claimError.message);
  }

  let profile = claimed || (await fetchProfileByAuthId(authUser.id));

  if (!profile) {
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
    else profile = created;
  }

  if (!profile) return null;

  // Always reload with role join — RPC rows often omit nested roles
  const withRole = await fetchProfileByAuthId(authUser.id);
  if (withRole) profile = withRole;

  if (!profile) return null;

  const roleRelation = profile.roles;
  let roleSlug =
    (Array.isArray(roleRelation) ? roleRelation[0]?.slug : roleRelation?.slug) ||
    profile.role_slug ||
    null;

  let restaurantId = null;
  const { data: owned } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', profile.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (owned?.id) {
    restaurantId = owned.id;
    // Safety: owning a restaurant means owner UI, even if role join failed
    if (!roleSlug || roleSlug === 'customer') {
      roleSlug = 'restaurant_owner';
    }
  }

  return {
    id: profile.id,
    authUserId: authUser.id,
    role: roleSlug || 'customer',
    phone: normalizePhone(profile.phone),
    fullName: profile.full_name || 'User',
    restaurantId,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const syncSession = useCallback(async (session) => {
    if (!session?.user) {
      setUser(null);
      return null;
    }
    try {
      let profile = await claimAndLoadProfile(session.user, session.user.phone);

      // Ensure RLS helper can see this login (addresses/orders policies depend on it).
      const { data: appUserId } = await supabase.rpc('current_app_user_id');
      if (!appUserId) {
        await supabase.rpc('ensure_customer_profile', {
          p_full_name:
            profile?.fullName ||
            session.user.user_metadata?.full_name ||
            'Customer',
          p_phone: session.user.phone || profile?.phone || '',
        });
        profile = await claimAndLoadProfile(session.user, session.user.phone);
      } else if (profile && profile.id !== appUserId) {
        profile = { ...profile, id: appUserId };
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

  async function sendOtp(phone) {
    setAuthError('');
    const e164 = toE164India(phone);
    if (!e164) {
      const msg = 'Enter a valid 10-digit mobile number';
      setAuthError(msg);
      return { error: msg };
    }

    const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
    if (error) {
      setAuthError(error.message);
      return { error: error.message, phone: e164 };
    }
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

    if (error) {
      setAuthError(error.message);
      return { error: error.message };
    }

    const profile = await syncSession(data.session);
    return { user: profile, session: data.session };
  }

  async function loginWithPassword(phone, password) {
    setAuthError('');
    const digits = normalizePhone(phone);
    if (digits.length !== 10) {
      const msg = 'Enter a valid 10-digit mobile number';
      setAuthError(msg);
      return { error: msg };
    }
    if (!password) {
      const msg = 'Enter your password';
      setAuthError(msg);
      return { error: msg };
    }

    // Admins are seeded as email+password: {phone}@admin.getnear.app
    const adminEmail = `${digits}@admin.getnear.app`;
    let { data, error } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password,
    });

    // Customers may use phone+password after OTP signup
    if (error) {
      const e164 = toE164India(phone);
      ({ data, error } = await supabase.auth.signInWithPassword({
        phone: e164,
        password,
      }));
    }

    if (error) {
      setAuthError(error.message);
      return { error: error.message };
    }

    const profile = await syncSession(data.session);
    return { user: profile, session: data.session };
  }

  async function savePassword(password) {
    setAuthError('');
    if (!password || password.length < 6) {
      const msg = 'Password must be at least 6 characters';
      setAuthError(msg);
      return { error: msg };
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setAuthError(error.message);
      return { error: error.message };
    }
    return { ok: true };
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

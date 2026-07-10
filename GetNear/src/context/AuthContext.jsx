import { createContext, useContext, useMemo, useState } from 'react';
import { adminUsers } from '../data/mockData';

const AUTH_KEY = 'getnear-auth';

export function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return null;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadSession);

  function login(session) {
    setUser(session);
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(session));
  }

  function logout() {
    setUser(null);
    sessionStorage.removeItem(AUTH_KEY);
  }

  const isAdmin = user?.role === 'admin';
  const isRestaurantOwner = user?.role === 'restaurant_owner';

  const value = useMemo(
    () => ({
      user,
      isAdmin,
      isRestaurantOwner,
      isAuthenticated: Boolean(user),
      login,
      logout,
      normalizePhone,
    }),
    [user, isAdmin, isRestaurantOwner],
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

/** Resolve role from phone against admins and restaurant owner assignments. */
export function resolveUserFromPhone(phone, businesses) {
  const normalized = normalizePhone(phone);
  if (normalized.length < 10) return null;

  const admin = adminUsers.find(
    (a) => normalizePhone(a.phone) === normalized,
  );
  if (admin) {
    return {
      role: 'admin',
      phone: normalized,
      fullName: admin.fullName,
      restaurantId: null,
    };
  }

  const owned = businesses.find(
    (b) => normalizePhone(b.ownerPhone) === normalized,
  );
  if (owned) {
    return {
      role: 'restaurant_owner',
      phone: normalized,
      fullName: owned.ownerName || owned.name,
      restaurantId: owned.id,
    };
  }

  return {
    role: 'customer',
    phone: normalized,
    fullName: 'Customer',
    restaurantId: null,
  };
}

export function getPostLoginPath(user) {
  if (user?.role === 'admin') return '/admin';
  if (user?.role === 'restaurant_owner') return '/owner/menu';
  return '/';
}

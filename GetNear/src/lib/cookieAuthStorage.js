/**
 * Cookie-backed storage adapter for @supabase/supabase-js.
 * Chunks large session payloads across multiple cookies (4KB browser limit).
 * Cookies: Path=/, SameSite=Lax, Secure on HTTPS, Max-Age=60 days.
 */
const MAX_CHUNK = 3000;
const MAX_AGE = 60 * 60 * 24 * 60; // 60 days

function cookieAttrs() {
  const secure =
    typeof location !== 'undefined' && location.protocol === 'https:'
      ? '; Secure'
      : '';
  return `; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure}`;
}

function getRaw(name) {
  if (typeof document === 'undefined') return null;
  const prefix = `${encodeURIComponent(name)}=`;
  const hit = document.cookie.split('; ').find((c) => c.startsWith(prefix));
  if (!hit) return null;
  try {
    return decodeURIComponent(hit.slice(prefix.length));
  } catch {
    return null;
  }
}

function setRaw(name, value) {
  if (typeof document === 'undefined') return;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}${cookieAttrs()}`;
}

function removeRaw(name) {
  if (typeof document === 'undefined') return;
  document.cookie = `${encodeURIComponent(name)}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export const cookieAuthStorage = {
  getItem(key) {
    const single = getRaw(key);
    if (single) return single;

    const chunks = [];
    for (let i = 0; ; i += 1) {
      const part = getRaw(`${key}.${i}`);
      if (!part) break;
      chunks.push(part);
    }
    return chunks.length ? chunks.join('') : null;
  },

  setItem(key, value) {
    // Clear previous single + chunked forms
    removeRaw(key);
    for (let i = 0; getRaw(`${key}.${i}`) != null; i += 1) {
      removeRaw(`${key}.${i}`);
    }

    if (value.length <= MAX_CHUNK) {
      setRaw(key, value);
      return;
    }

    const total = Math.ceil(value.length / MAX_CHUNK);
    for (let i = 0; i < total; i += 1) {
      setRaw(`${key}.${i}`, value.slice(i * MAX_CHUNK, (i + 1) * MAX_CHUNK));
    }
  },

  removeItem(key) {
    removeRaw(key);
    for (let i = 0; getRaw(`${key}.${i}`) != null; i += 1) {
      removeRaw(`${key}.${i}`);
    }
  },
};

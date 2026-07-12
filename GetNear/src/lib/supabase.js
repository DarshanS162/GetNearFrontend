import { createClient } from '@supabase/supabase-js';
import { cookieAuthStorage } from './cookieAuthStorage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const hasConfig =
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  !String(supabaseAnonKey).includes('PASTE_YOUR') &&
  !String(supabaseAnonKey).includes('your-anon');

if (!hasConfig) {
  console.error(
    '[GetNear] Missing Supabase config. Create GetNear/.env with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (anon/public key from Dashboard → Settings → API), then restart npm run dev.',
  );
}

export const supabase = hasConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: cookieAuthStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : new Proxy(
      {},
      {
        get() {
          throw new Error(
            'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to GetNear/.env and restart the dev server.',
          );
        },
      },
    );

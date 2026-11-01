import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const supabase = url && key
  ? createClient(url, key, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  })
  : null;

export function getSupabase() {
  if (!supabase) {
    throw Object.assign(new Error('Supabase is not configured'), { code: 'configuration_error' });
  }
  return supabase;
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Server-only client. Uses the service role key, so never import this into client components.
// No generated table types, so rows are loosely typed.
let client: SupabaseClient<any, 'public', any> | null = null;

export function db(): SupabaseClient<any, 'public', any> {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  client = createClient<any, 'public', any>(url, key, { auth: { persistSession: false } });
  return client;
}

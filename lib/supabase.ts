import { createClient } from '@supabase/supabase-js';

// Server-only client. Uses the service role key, so never import this into client components.
let client: ReturnType<typeof createClient> | null = null;

export function db() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

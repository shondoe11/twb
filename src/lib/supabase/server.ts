//* server-only supabase client fr crowd-sourced community remarks
//* keys stay server-side - the browser only ever talks to our /api/remarks route
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

//& lazy singleton so builds w/o env vars don't crash at import time
export function getSupabase(): SupabaseClient | null {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  //~ new-format 'sb_publishable_...' key replaces legacy anon key - both run as the anon role under rls
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    console.error('Supabase env vars missing: set SUPABASE_URL & SUPABASE_PUBLISHABLE_KEY');
    return null;
  }

  client = createClient(url, publishableKey, {
    auth: { persistSession: false },
  });
  return client;
}

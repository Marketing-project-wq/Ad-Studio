import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './config';

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/** Server-side check: are the vars needed for privileged writes present? */
export function isSupabaseServerConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);
}

let serverClient: SupabaseClient | null = null;

/**
 * Returns a service-role Supabase client for server routes, or null when not
 * configured. Never import this into client components.
 */
export function getSupabaseServer(): SupabaseClient | null {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  if (!serverClient) {
    serverClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serverClient;
}

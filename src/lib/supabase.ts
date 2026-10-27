import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

/**
 * Single Supabase client for the entire backend.
 * Uses the service-role key — bypasses RLS.
 * persistSession is false: this is a server-side client, not browser.
 */
export const supabase = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

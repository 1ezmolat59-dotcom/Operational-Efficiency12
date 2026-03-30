import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env')
}

// Service-role admin client — bypasses RLS, used for all backend operations
declare global {
  // eslint-disable-next-line no-var
  var __supabase: SupabaseClient | undefined
}

const supabase: SupabaseClient =
  global.__supabase ||
  createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

if (process.env.NODE_ENV !== 'production') {
  global.__supabase = supabase
}

export default supabase

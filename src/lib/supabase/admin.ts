import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  // Admin client runs server-side — use SUPABASE_DIRECT_URL to skip the proxy.
  const supabaseUrl = process.env.SUPABASE_DIRECT_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

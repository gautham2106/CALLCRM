import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Route browser requests through the Next.js proxy so they go via Vercel
  // instead of hitting Supabase directly (avoids ISP-level blocks).
  const supabaseUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/supabase`
      : process.env.NEXT_PUBLIC_SUPABASE_URL!

  return createBrowserClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

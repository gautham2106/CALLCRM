import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Always use the real Supabase URL so the auth storage key (cookie name) is
  // consistent between browser and server clients.
  //
  // For browser requests we intercept fetch and route through the Next.js proxy
  // (/api/supabase) so traffic goes  Jio → Vercel → Supabase  instead of
  // hitting supabase.co directly (which Jio blocks).
  //
  // We detect Supabase calls by hostname rather than comparing against
  // process.env.NEXT_PUBLIC_SUPABASE_URL because that env var is inlined at
  // build time and may not match correctly in all Vercel environments.
  const isClient = typeof window !== 'undefined'

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    isClient
      ? {
          global: {
            fetch: (url: RequestInfo | URL, init?: RequestInit) => {
              const original = url.toString()
              try {
                const u = new URL(original)
                // Route any supabase.co (or supabase.in) hostname through proxy.
                if (u.hostname.endsWith('.supabase.co') || u.hostname.endsWith('.supabase.in')) {
                  const proxyBase = `${window.location.origin}/api/supabase`
                  const proxied = proxyBase + u.pathname + u.search
                  return fetch(proxied, init)
                }
              } catch {
                // If URL parsing fails, fall through to native fetch
              }
              return fetch(original, init)
            },
          },
        }
      : undefined
  )
}

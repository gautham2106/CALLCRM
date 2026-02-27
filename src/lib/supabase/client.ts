import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Always use the real Supabase URL so the auth storage key (cookie name) is
  // consistent with what the server client and middleware expect.
  // For browser requests, override fetch to route through the Next.js proxy so
  // traffic never goes directly to Supabase from the client (avoids ISP blocks).
  const isClient = typeof window !== 'undefined'

  // Strip trailing slash once so URL concatenation is always clean.
  const supabaseOrigin = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    isClient
      ? {
          global: {
            fetch: (url: RequestInfo | URL, init?: RequestInit) => {
              const original = url.toString()
              const proxyBase = `${window.location.origin}/api/supabase`
              // Rewrite only requests that target the Supabase project URL.
              const proxied = supabaseOrigin && original.startsWith(supabaseOrigin)
                ? proxyBase + original.slice(supabaseOrigin.length)
                : original
              return fetch(proxied, init)
            },
          },
        }
      : undefined
  )
}

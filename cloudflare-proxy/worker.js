/**
 * Cloudflare Worker — Supabase ISP-block proxy
 *
 * Deploy steps:
 *   1. workers.cloudflare.com → Create Worker → paste this file
 *   2. Worker Settings → Variables → add:
 *        SUPABASE_URL = https://your-project-ref.supabase.co
 *   3. Deploy — copy the worker URL
 *   4. Vercel → NEXT_PUBLIC_SUPABASE_URL = <worker URL>
 *   5. Redeploy Vercel
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'apikey, Authorization, Content-Type, Prefer, X-Client-Info, X-Supabase-Api-Version, Accept-Profile, Content-Profile, Range',
  'Access-Control-Expose-Headers': 'Content-Range, X-Total-Count',
  'Access-Control-Max-Age': '86400',
}

export default {
  async fetch(request, env) {
    // Respond to CORS preflight immediately
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    try {
      // Normalize SUPABASE_URL — add https:// if missing, strip trailing slash
      let base = (env.SUPABASE_URL || '').trim().replace(/\/$/, '')
      if (!base.startsWith('http')) base = 'https://' + base

      const target = new URL(base)
      const incoming = new URL(request.url)

      // Build the destination URL: Supabase origin + incoming path + query
      const dest = target.origin + incoming.pathname + incoming.search

      // Strip Cloudflare-injected and hop-by-hop headers
      const headers = new Headers(request.headers)
      for (const h of ['host', 'content-length', 'cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'cf-visitor']) {
        headers.delete(h)
      }

      const response = await fetch(dest, {
        method: request.method,
        headers,
        // GET and HEAD must not have a body
        body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
        redirect: 'follow',
      })

      const out = new Headers(response.headers)
      for (const [k, v] of Object.entries(CORS_HEADERS)) out.set(k, v)

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: out,
      })
    } catch (err) {
      // Surface errors as JSON so they're visible in the browser / Supabase client
      return new Response(JSON.stringify({ proxy_error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      })
    }
  },
}

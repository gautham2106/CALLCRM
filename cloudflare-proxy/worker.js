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
    // Respond to CORS preflight immediately — don't forward to Supabase
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const supabaseOrigin = new URL(env.SUPABASE_URL).origin
    const url = new URL(request.url)
    const targetUrl = supabaseOrigin + url.pathname + url.search

    // Strip Cloudflare-injected and hop-by-hop headers before forwarding
    const headers = new Headers(request.headers)
    headers.delete('host')
    headers.delete('content-length')   // let fetch recalculate
    headers.delete('cf-connecting-ip')
    headers.delete('cf-ipcountry')
    headers.delete('cf-ray')
    headers.delete('cf-visitor')

    const response = await fetch(
      new Request(targetUrl, {
        method: request.method,
        headers,
        body: request.body,
        redirect: 'follow',
      })
    )

    // Attach CORS headers to every response so the browser accepts it
    const newHeaders = new Headers(response.headers)
    for (const [k, v] of Object.entries(CORS_HEADERS)) {
      newHeaders.set(k, v)
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    })
  },
}

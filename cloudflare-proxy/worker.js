/**
 * Cloudflare Worker — Supabase ISP-block proxy
 *
 * Forwards all requests to your Supabase project so that ISPs (e.g. Jio India)
 * that block Supabase's IPs cannot reach the backend directly from user browsers.
 *
 * Deploy steps:
 *   1. Go to https://workers.cloudflare.com and create a new Worker
 *   2. Paste this file's contents into the editor
 *   3. Add an Environment Variable in the Worker settings:
 *        SUPABASE_URL = https://your-project-ref.supabase.co
 *   4. Deploy — note the Worker URL (e.g. supabase-proxy.yourname.workers.dev)
 *   5. On Vercel, set NEXT_PUBLIC_SUPABASE_URL = https://supabase-proxy.yourname.workers.dev
 *   6. Redeploy your Vercel app
 */

export default {
  async fetch(request, env) {
    const supabaseOrigin = new URL(env.SUPABASE_URL).origin

    // Rewrite the incoming URL to point at Supabase, keeping path + query intact
    const url = new URL(request.url)
    const targetUrl = supabaseOrigin + url.pathname + url.search

    // Forward the request with all original headers (apikey, Authorization, etc.)
    const proxied = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'follow',
    })

    const response = await fetch(proxied)

    // Pass the response back with CORS headers so browsers accept it
    const newHeaders = new Headers(response.headers)
    newHeaders.set('Access-Control-Allow-Origin', '*')
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    newHeaders.set('Access-Control-Allow-Headers', '*')

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: newHeaders })
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    })
  },
}

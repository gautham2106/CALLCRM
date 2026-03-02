import { NextRequest, NextResponse } from 'next/server'

// Read target URL at request time (runtime), not build time.
// NEXT_PUBLIC_SUPABASE_URL is always present in every Vercel environment.
function getSupabaseUrl(): string {
  return (
    process.env.SUPABASE_DIRECT_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).replace(/\/$/, '')
}

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const supabaseUrl = getSupabaseUrl()
  if (!supabaseUrl) {
    return NextResponse.json({ error: 'Supabase URL not configured' }, { status: 503 })
  }

  const { path } = await params
  const { search } = new URL(req.url)
  const targetUrl = `${supabaseUrl}/${path.join('/')}${search}`

  // Forward relevant request headers; strip hop-by-hop headers.
  const reqHeaders = new Headers()
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (!['host', 'connection', 'transfer-encoding'].includes(lower)) {
      reqHeaders.set(key, value)
    }
  })

  // Buffer the request body so we never pass a half-consumed ReadableStream.
  const hasBody = !['GET', 'HEAD'].includes(req.method)
  const body = hasBody ? await req.arrayBuffer() : undefined

  let response: Response
  try {
    response = await fetch(targetUrl, {
      method: req.method,
      headers: reqHeaders,
      body: body ?? undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `Proxy failed: ${message}` },
      { status: 502 }
    )
  }

  // Buffer the response so we can safely manipulate headers.
  let resBody: ArrayBuffer
  try {
    resBody = await response.arrayBuffer()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[supabase-proxy] Failed to buffer response from ${targetUrl}:`, message)
    return NextResponse.json(
      { error: `Proxy buffer failed: ${message}` },
      { status: 502 }
    )
  }

  // Log non-2xx responses from Supabase to help diagnose production issues.
  if (response.status >= 400) {
    try {
      const errText = new TextDecoder().decode(resBody)
      console.error(
        `[supabase-proxy] Supabase returned ${response.status} for ${req.method} ${targetUrl} — body: ${errText}`
      )
    } catch {
      // ignore decode errors
    }
  }

  // Build clean response headers — strip anything that leaks Supabase identity
  // or causes content-decoding issues on the browser side.
  const resHeaders = new Headers()
  response.headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (
      lower === 'connection' ||
      lower === 'transfer-encoding' ||
      lower === 'content-encoding' || // already decoded since we buffered
      lower === 'content-length' ||    // will be recalculated
      lower.startsWith('x-supabase-') ||
      lower.startsWith('sb-')
    ) {
      return // drop
    }
    resHeaders.set(key, value)
  })

  return new NextResponse(resBody, {
    status: response.status,
    headers: resHeaders,
  })
}

export const GET    = handler
export const POST   = handler
export const PUT    = handler
export const PATCH  = handler
export const DELETE = handler
export const OPTIONS = handler

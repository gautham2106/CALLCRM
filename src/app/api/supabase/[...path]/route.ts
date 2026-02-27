import { NextRequest, NextResponse } from 'next/server'

// Prefer an explicit server-only URL; fall back to the public URL which is
// always present in every Vercel environment (production + preview).
const SUPABASE_URL = (
  process.env.SUPABASE_DIRECT_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
).replace(/\/$/, '') // strip trailing slash so we never get double slashes

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (!SUPABASE_URL) {
    return NextResponse.json(
      { error: 'Supabase URL is not configured. Set NEXT_PUBLIC_SUPABASE_URL in your environment.' },
      { status: 503 }
    )
  }

  const { path } = await params
  const url = new URL(req.url)
  const targetUrl = `${SUPABASE_URL}/${path.join('/')}${url.search}`

  const headers = new Headers()
  req.headers.forEach((value, key) => {
    if (!['host', 'connection'].includes(key.toLowerCase())) {
      headers.set(key, value)
    }
  })

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'

  let response: Response
  try {
    response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
      // @ts-ignore — duplex required for streaming request bodies
      duplex: 'half',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `Proxy failed to reach Supabase: ${message}` },
      { status: 502 }
    )
  }

  const responseHeaders = new Headers()
  response.headers.forEach((value, key) => {
    // Strip hop-by-hop and encoding headers: Vercel's fetch already decompresses
    // the body, so forwarding Content-Encoding would make the browser try to
    // decompress again → ERR_CONTENT_DECODING_FAILED.
    if (!['connection', 'transfer-encoding', 'content-encoding', 'content-length'].includes(key.toLowerCase())) {
      responseHeaders.set(key, value)
    }
  })

  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  })
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
export const OPTIONS = handler

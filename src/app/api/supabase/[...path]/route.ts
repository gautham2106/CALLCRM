import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.SUPABASE_DIRECT_URL!

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
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

  const response = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: hasBody ? req.body : undefined,
    // @ts-ignore — duplex required for streaming request bodies
    duplex: 'half',
  })

  const responseHeaders = new Headers()
  response.headers.forEach((value, key) => {
    if (!['connection', 'transfer-encoding'].includes(key.toLowerCase())) {
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

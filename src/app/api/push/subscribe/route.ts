import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('id, college_id')
    .eq('auth_id', user.id)
    .single()
  return profile
}

// POST — save or update a push subscription for the current device.
// Each device/browser gets its own row (keyed by endpoint), so a user
// on multiple devices receives notifications on all of them.
export async function POST(request: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subscription } = await request.json()
  if (!subscription?.endpoint) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })

  const admin = createAdminClient()
  await admin.from('push_subscriptions').upsert(
    {
      user_id: profile.id,
      college_id: profile.college_id,
      subscription,
      endpoint: subscription.endpoint,
    },
    { onConflict: 'endpoint' }
  )

  return NextResponse.json({ success: true })
}

// DELETE — remove the push subscription for a specific device endpoint.
// Called on sign-out so the device stops receiving the signed-out user's
// notifications. If no endpoint is provided, removes all subscriptions
// for the user (full opt-out).
export async function DELETE(request: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  let endpoint: string | null = null
  try {
    const body = await request.json()
    endpoint = body.endpoint ?? null
  } catch {
    // No body — full opt-out
  }

  if (endpoint) {
    await admin.from('push_subscriptions').delete()
      .eq('user_id', profile.id)
      .eq('endpoint', endpoint)
  } else {
    await admin.from('push_subscriptions').delete().eq('user_id', profile.id)
  }

  return NextResponse.json({ success: true })
}

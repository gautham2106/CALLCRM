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

// POST — save or update a push subscription for this specific device.
// Keyed by endpoint so a counsellor's phone and a shared college PC each
// get their own row and both receive notifications simultaneously.
// Falls back to user_id keying if the multi-device migration hasn't been run yet.
export async function POST(request: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subscription } = await request.json()
  if (!subscription?.endpoint) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })

  const admin = createAdminClient()

  // Try multi-device approach first (requires migration 20240302_push_subscriptions_multidevice.sql)
  const { error: endpointError } = await admin.from('push_subscriptions').upsert(
    {
      user_id: profile.id,
      college_id: profile.college_id,
      subscription,
      endpoint: subscription.endpoint,
    },
    { onConflict: 'endpoint' }
  )

  if (endpointError) {
    // Migration not run yet — fall back to single-device (one row per user)
    await admin.from('push_subscriptions').upsert(
      { user_id: profile.id, college_id: profile.college_id, subscription },
      { onConflict: 'user_id' }
    )
  }

  return NextResponse.json({ success: true })
}

// DELETE — remove only this device's push subscription on sign-out.
// This prevents the next person who logs in on a shared PC from seeing
// the previous user's notifications. The user's phone subscription
// (different endpoint) is unaffected and keeps receiving notifications.
export async function DELETE(request: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  let endpoint: string | null = null
  try {
    const body = await request.json()
    endpoint = body.endpoint ?? null
  } catch {
    // no body
  }

  if (endpoint) {
    // Delete only this specific device's subscription
    await admin.from('push_subscriptions').delete()
      .eq('user_id', profile.id)
      .eq('endpoint', endpoint)
  } else {
    // Fallback: delete all subscriptions for user (full opt-out)
    await admin.from('push_subscriptions').delete().eq('user_id', profile.id)
  }

  return NextResponse.json({ success: true })
}

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

// POST — save or update the push subscription for the current user.
// One subscription per user (onConflict: 'user_id') is sufficient when
// each counsellor uses their own personal device.
export async function POST(request: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subscription } = await request.json()
  if (!subscription?.endpoint) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })

  const admin = createAdminClient()
  await admin.from('push_subscriptions').upsert(
    { user_id: profile.id, college_id: profile.college_id, subscription },
    { onConflict: 'user_id' }
  )

  return NextResponse.json({ success: true })
}

// DELETE — remove the push subscription for the current user.
// Called on sign-out to clean up stale tokens (e.g. when switching phones).
export async function DELETE() {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  await admin.from('push_subscriptions').delete().eq('user_id', profile.id)

  return NextResponse.json({ success: true })
}

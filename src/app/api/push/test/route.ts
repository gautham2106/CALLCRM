import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { sendPush } from '@/lib/webpush'
import webpush from 'web-push'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/push/test?user_id=<uuid>
// Sends a test push to all subscriptions of a user (or all users if no user_id)
// Requires admin authentication
export async function GET(req: Request) {
  // Require admin authentication
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, college_id')
    .eq('auth_id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')

  let query = admin.from('push_subscriptions').select('id, user_id, subscription')
  if (userId) query = query.eq('user_id', userId)

  const { data: subs, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!subs?.length) return NextResponse.json({ sent: 0, message: 'No subscriptions found' })

  let sent = 0
  let expired = 0
  const expiredIds: string[] = []

  for (const row of subs) {
    const result = await sendPush(row.subscription as webpush.PushSubscription, {
      title: 'Test Notification',
      body: '🔔 Push is working! This is a manual test.',
      url: '/counsellor',
      tag: 'test',
    })
    if (result === true) sent++
    else if (result === 'expired') {
      expired++
      expiredIds.push(row.id)
    }
  }

  if (expiredIds.length) {
    await admin.from('push_subscriptions').delete().in('id', expiredIds)
  }

  return NextResponse.json({ sent, expiredCleaned: expired, total: subs.length })
}

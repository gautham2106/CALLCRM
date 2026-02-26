import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// POST /api/admin/import-notify
// Called after CSV import when leads are directly assigned to a counsellor.
// Creates an in-app notification and sends a push notification.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id, role, college_id')
    .eq('auth_id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { counsellorId, count } = await request.json()
  if (!counsellorId || !count) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = createAdminClient()
  const message = `${count} lead${count > 1 ? 's' : ''} imported and assigned to you`

  // Create in-app notification
  await admin.from('notifications').insert({
    user_id: counsellorId,
    college_id: profile.college_id,
    type: 'bulk_leads',
    message,
    bulk_count: count,
  })

  // Send push notification
  const { data: pushSubs } = await admin
    .from('push_subscriptions')
    .select('id, subscription')
    .eq('user_id', counsellorId)

  if (pushSubs?.length) {
    const { sendPush } = await import('@/lib/webpush')
    for (const row of pushSubs) {
      const result = await sendPush(row.subscription, {
        title: 'New Leads Assigned',
        body: message,
        url: '/counsellor/leads',
        tag: 'lead-import',
      })
      if (result === 'expired') {
        await admin.from('push_subscriptions').delete().eq('id', row.id)
      }
    }
  }

  return NextResponse.json({ success: true })
}

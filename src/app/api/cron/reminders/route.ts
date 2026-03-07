import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/webpush'
import { todayIST } from '@/lib/utils'
import { trackBrevoEvent } from '@/lib/brevo'

// GET /api/cron/reminders
// Called by Vercel Cron 4 times a day.
// Finds counsellors who have follow-ups or visits due today and sends a push summary.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/reminders] CRON_SECRET environment variable is not set')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  const secret = request.headers.get('authorization')
  if (secret !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Today's date in YYYY-MM-DD (UTC). Vercel cron runs in UTC.
  const today = todayIST()

  // Fetch all active leads due today (follow-up or visit), with assigned counsellor
  const { data: leads, error } = await admin
    .from('leads')
    .select('id, name, follow_up_date, visit_date, assigned_to, college_id')
    .eq('is_active', true)
    .not('assigned_to', 'is', null)
    .or(`follow_up_date.eq.${today},visit_date.eq.${today}`)

  if (error) {
    console.error('[cron/reminders] DB error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!leads?.length) {
    return NextResponse.json({ sent: 0, message: 'No reminders due today' })
  }

  // Group by counsellor
  const byCounsellor: Record<string, { followUps: number; visits: number; collegeId: string }> = {}
  for (const lead of leads) {
    const uid = lead.assigned_to as string
    if (!byCounsellor[uid]) {
      byCounsellor[uid] = { followUps: 0, visits: 0, collegeId: lead.college_id }
    }
    if (lead.follow_up_date === today) byCounsellor[uid].followUps++
    if (lead.visit_date === today) byCounsellor[uid].visits++
  }

  const counsellorIds = Object.keys(byCounsellor)

  // Fetch counsellor emails (for Brevo identifiers) and push subscriptions in parallel
  const [{ data: counsellorUsers }, { data: allSubs }] = await Promise.all([
    admin
      .from('users')
      .select('id, email')
      .in('id', counsellorIds),
    admin
      .from('push_subscriptions')
      .select('id, user_id, subscription')
      .in('user_id', counsellorIds),
  ])

  // Map counsellor id → email for Brevo event tracking
  const counsellorEmailMap: Record<string, string> = {}
  for (const u of counsellorUsers ?? []) {
    if (u.email) counsellorEmailMap[u.id] = u.email
  }

  let totalSent = 0
  const expiredIds: string[] = []

  for (const [counsellorId, counts] of Object.entries(byCounsellor)) {
    // Fire Brevo event for every counsellor with pending tasks, regardless of push status
    const counsellorEmail = counsellorEmailMap[counsellorId]
    if (counsellorEmail) {
      trackBrevoEvent('counsellor_daily_pending', { email_id: counsellorEmail }, {
        event_properties: {
          follow_ups_pending: counts.followUps,
          visits_pending: counts.visits,
          date: today,
        },
      })
    }

    const subs = (allSubs ?? []).filter((s) => s.user_id === counsellorId)
    if (!subs.length) continue

    // Build push message
    const parts: string[] = []
    if (counts.followUps > 0) {
      parts.push(`${counts.followUps} follow-up${counts.followUps > 1 ? 's' : ''}`)
    }
    if (counts.visits > 0) {
      parts.push(`${counts.visits} visit${counts.visits > 1 ? 's' : ''}`)
    }
    const body = `${parts.join(' and ')} due today`

    for (const sub of subs) {
      const result = await sendPush(sub.subscription, {
        title: 'Reminder: Pending Tasks',
        body,
        url: '/counsellor/leads',
        tag: 'daily-reminder',
      })
      if (result === 'expired') {
        expiredIds.push(sub.id)
      } else if (result === true) {
        totalSent++
      }
    }
  }

  // Clean up expired subscriptions
  if (expiredIds.length) {
    await admin.from('push_subscriptions').delete().in('id', expiredIds)
  }

  return NextResponse.json({ sent: totalSent, expiredCleaned: expiredIds.length })
}

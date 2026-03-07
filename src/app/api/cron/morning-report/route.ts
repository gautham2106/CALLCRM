import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendBrevoEmail, trackBrevoEvent } from '@/lib/brevo'
import { todayIST } from '@/lib/utils'

// GET /api/cron/morning-report
// Scheduled daily at 07:00 IST (01:30 UTC) via Vercel Cron.
// Sends each college's admin(s) an HTML summary of:
//   - Today's follow-ups and visits per counsellor
//   - Overdue follow-ups and visits
//   - New leads added yesterday
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/morning-report] CRON_SECRET not set')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = todayIST()

  // yesterday in YYYY-MM-DD
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = yesterdayDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

  // 1. Fetch all active colleges
  const { data: colleges } = await admin
    .from('colleges')
    .select('id, name')
    .eq('is_active', true)

  if (!colleges?.length) {
    return NextResponse.json({ sent: 0, message: 'No active colleges' })
  }

  let emailsSent = 0

  for (const college of colleges) {
    // 2. Fetch admins for this college
    const { data: admins } = await admin
      .from('users')
      .select('id, name, email')
      .eq('college_id', college.id)
      .eq('role', 'admin')
      .eq('is_active', true)

    if (!admins?.length) continue

    // 3. Fetch all active leads for this college in one query
    const { data: leads } = await admin
      .from('leads')
      .select('id, name, phone, email, source_name, follow_up_date, visit_date, current_lead_stage, created_at')
      .eq('college_id', college.id)
      .eq('is_active', true)

    if (!leads) continue

    // Partition leads into buckets
    let totalFollowUps = 0
    let totalVisits = 0
    const newYesterday: typeof leads = []

    for (const lead of leads) {
      if (lead.follow_up_date === today) totalFollowUps++
      if (lead.visit_date === today) totalVisits++
      if (lead.created_at.slice(0, 10) === yesterday) newYesterday.push(lead)
    }

    // 4. Batch-track lead_created events in Brevo for leads created yesterday
    for (const lead of newYesterday) {
      const identifiers: Record<string, string> = {}
      if (lead.phone) identifiers.phone_id = lead.phone
      if (lead.email) identifiers.email_id = lead.email
      if (Object.keys(identifiers).length > 0) {
        trackBrevoEvent('lead_created', identifiers, {
          event_properties: {
            lead_id: lead.id,
            lead_stage: lead.current_lead_stage ?? 'New Enquiry',
            ...(lead.source_name ? { source: lead.source_name } : {}),
          },
          contact_properties: { FIRSTNAME: lead.name },
        })
      }
    }

    // 6. Build HTML email
    const html = buildReportHtml({
      collegeName: college.name,
      today,
      totalFollowUps,
      totalVisits,
      newLeadsYesterday: newYesterday.length,
    })

    // 7. Send to each admin
    for (const adminUser of admins) {
      await sendBrevoEmail({
        to: [{ email: adminUser.email, name: adminUser.name }],
        subject: `Morning Report — ${college.name} — ${today}`,
        htmlContent: html,
      })
      emailsSent++
    }
  }

  return NextResponse.json({ sent: emailsSent })
}

interface ReportData {
  collegeName: string
  today: string
  totalFollowUps: number
  totalVisits: number
  newLeadsYesterday: number
}

function buildReportHtml(d: ReportData): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;color:#111827;">
  <div style="max-width:480px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

    <div style="background:#1d4ed8;padding:24px 32px;">
      <p style="margin:0;font-size:12px;color:#93c5fd;text-transform:uppercase;letter-spacing:1px;">Daily Morning Report</p>
      <h1 style="margin:4px 0 0;font-size:20px;color:#ffffff;">${d.collegeName}</h1>
      <p style="margin:4px 0 0;font-size:13px;color:#bfdbfe;">${d.today}</p>
    </div>

    <div style="padding:24px 32px;display:flex;gap:12px;flex-wrap:wrap;">
      <div style="flex:1;min-width:100px;background:#eff6ff;border-radius:8px;padding:16px;text-align:center;">
        <p style="margin:0;font-size:32px;font-weight:700;color:#1d4ed8;">${d.newLeadsYesterday}</p>
        <p style="margin:6px 0 0;font-size:12px;color:#3b82f6;">New Leads</p>
      </div>
      <div style="flex:1;min-width:100px;background:#faf5ff;border-radius:8px;padding:16px;text-align:center;">
        <p style="margin:0;font-size:32px;font-weight:700;color:#7c3aed;">${d.totalFollowUps}</p>
        <p style="margin:6px 0 0;font-size:12px;color:#8b5cf6;">Follow-ups</p>
      </div>
      <div style="flex:1;min-width:100px;background:#f0fdf4;border-radius:8px;padding:16px;text-align:center;">
        <p style="margin:0;font-size:32px;font-weight:700;color:#16a34a;">${d.totalVisits}</p>
        <p style="margin:6px 0 0;font-size:12px;color:#22c55e;">Visits</p>
      </div>
    </div>

    <div style="padding:0 32px 20px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">CallCRM • Do not reply</p>
    </div>
  </div>
</body>
</html>`
}

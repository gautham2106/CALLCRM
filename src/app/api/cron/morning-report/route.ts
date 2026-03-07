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

    // 3. Fetch all counsellors for name lookup
    const { data: counsellors } = await admin
      .from('users')
      .select('id, name')
      .eq('college_id', college.id)
      .eq('role', 'counsellor')
      .eq('is_active', true)

    const counsellorMap: Record<string, string> = {}
    for (const c of counsellors ?? []) counsellorMap[c.id] = c.name

    // 4. Fetch all active leads for this college in one query
    const { data: leads } = await admin
      .from('leads')
      .select('id, name, phone, email, source_name, assigned_to, follow_up_date, visit_date, current_lead_stage, created_at')
      .eq('college_id', college.id)
      .eq('is_active', true)

    if (!leads) continue

    // Partition leads into buckets
    const todayFollowUps: typeof leads = []
    const todayVisits: typeof leads = []
    const overdueFollowUps: typeof leads = []
    const overdueVisits: typeof leads = []
    const newYesterday: typeof leads = []

    for (const lead of leads) {
      if (lead.follow_up_date === today) todayFollowUps.push(lead)
      if (lead.visit_date === today) todayVisits.push(lead)
      if (lead.follow_up_date && lead.follow_up_date < today) overdueFollowUps.push(lead)
      if (
        lead.visit_date &&
        lead.visit_date < today &&
        lead.current_lead_stage !== 'Visit Done' &&
        lead.current_lead_stage !== 'Enrolled'
      ) {
        overdueVisits.push(lead)
      }
      const createdDate = lead.created_at.slice(0, 10)
      if (createdDate === yesterday) newYesterday.push(lead)
    }

    // Group by counsellor helper
    function groupByCounsellor(bucket: typeof leads) {
      const map: Record<string, number> = {}
      for (const lead of bucket) {
        if (lead.assigned_to) {
          map[lead.assigned_to] = (map[lead.assigned_to] ?? 0) + 1
        }
      }
      return map
    }

    const followUpsByCounsellor = groupByCounsellor(todayFollowUps)
    const visitsByCounsellor = groupByCounsellor(todayVisits)

    // 5. Batch-track lead_created events in Brevo for leads created yesterday
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

    // 7. Build counsellor rows for the table
    const allCounsellorIds = new Set([
      ...Object.keys(followUpsByCounsellor),
      ...Object.keys(visitsByCounsellor),
    ])

    const counsellorRows = [...allCounsellorIds]
      .map((id) => ({
        name: counsellorMap[id] ?? 'Unknown',
        followUps: followUpsByCounsellor[id] ?? 0,
        visits: visitsByCounsellor[id] ?? 0,
      }))
      .sort((a, b) => b.followUps + b.visits - (a.followUps + a.visits))

    // 8. Build HTML email
    const html = buildReportHtml({
      collegeName: college.name,
      today,
      counsellorRows,
      totalFollowUps: todayFollowUps.length,
      totalVisits: todayVisits.length,
      overdueFollowUps: overdueFollowUps.length,
      overdueVisits: overdueVisits.length,
      newLeadsYesterday: newYesterday.length,
      totalActive: leads.length,
    })

    // 9. Send to each admin
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
  counsellorRows: { name: string; followUps: number; visits: number }[]
  totalFollowUps: number
  totalVisits: number
  overdueFollowUps: number
  overdueVisits: number
  newLeadsYesterday: number
  totalActive: number
}

function buildReportHtml(d: ReportData): string {
  const counsellorTableRows = d.counsellorRows.length
    ? d.counsellorRows
        .map(
          (r) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${r.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${r.followUps}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${r.visits}</td>
      </tr>`
        )
        .join('')
    : `<tr><td colspan="3" style="padding:12px;text-align:center;color:#6b7280;">No tasks scheduled for today</td></tr>`

  const overdueSection =
    d.overdueFollowUps > 0 || d.overdueVisits > 0
      ? `
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-weight:600;color:#c2410c;">⚠️ Overdue Items</p>
      ${d.overdueFollowUps > 0 ? `<p style="margin:0 0 4px;color:#374151;">• <strong>${d.overdueFollowUps}</strong> overdue follow-up${d.overdueFollowUps !== 1 ? 's' : ''}</p>` : ''}
      ${d.overdueVisits > 0 ? `<p style="margin:0;color:#374151;">• <strong>${d.overdueVisits}</strong> overdue visit${d.overdueVisits !== 1 ? 's' : ''}</p>` : ''}
    </div>`
      : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;color:#111827;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background:#1d4ed8;padding:24px 32px;">
      <p style="margin:0;font-size:12px;color:#93c5fd;text-transform:uppercase;letter-spacing:1px;">Daily Morning Report</p>
      <h1 style="margin:4px 0 0;font-size:22px;color:#ffffff;">${d.collegeName}</h1>
      <p style="margin:4px 0 0;font-size:14px;color:#bfdbfe;">${d.today}</p>
    </div>

    <div style="padding:24px 32px;">

      <!-- Summary cards -->
      <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
        <div style="flex:1;min-width:120px;background:#eff6ff;border-radius:8px;padding:16px;text-align:center;">
          <p style="margin:0;font-size:28px;font-weight:700;color:#1d4ed8;">${d.totalFollowUps}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#3b82f6;">Follow-ups Today</p>
        </div>
        <div style="flex:1;min-width:120px;background:#f0fdf4;border-radius:8px;padding:16px;text-align:center;">
          <p style="margin:0;font-size:28px;font-weight:700;color:#16a34a;">${d.totalVisits}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#22c55e;">Visits Today</p>
        </div>
        <div style="flex:1;min-width:120px;background:#faf5ff;border-radius:8px;padding:16px;text-align:center;">
          <p style="margin:0;font-size:28px;font-weight:700;color:#7c3aed;">${d.newLeadsYesterday}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#8b5cf6;">New Leads Yesterday</p>
        </div>
        <div style="flex:1;min-width:120px;background:#f8fafc;border-radius:8px;padding:16px;text-align:center;">
          <p style="margin:0;font-size:28px;font-weight:700;color:#475569;">${d.totalActive}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Total Active Leads</p>
        </div>
      </div>

      <!-- Overdue warning -->
      ${overdueSection}

      <!-- Counsellor breakdown -->
      <h2 style="margin:0 0 12px;font-size:16px;font-weight:600;color:#1f2937;">Today's Tasks by Counsellor</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#374151;">Counsellor</th>
            <th style="padding:8px 12px;text-align:center;font-weight:600;color:#374151;">Follow-ups</th>
            <th style="padding:8px 12px;text-align:center;font-weight:600;color:#374151;">Visits</th>
          </tr>
        </thead>
        <tbody>
          ${counsellorTableRows}
        </tbody>
      </table>

    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">CallCRM • Automated morning report • Do not reply to this email</p>
    </div>
  </div>
</body>
</html>`
}

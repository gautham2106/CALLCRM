import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { AdminAnalyticsClient } from '@/components/admin/AdminAnalyticsClient'
import { todayIST } from '@/lib/utils'

// ----------------------------------------------------------------
// getDashboardData — replaced 3 full-table JS-aggregation queries
// with SQL GROUP BY functions (get_stage_counts, get_counsellor_stats,
// get_source_stats, get_source_stage_breakdown, get_source_recent_leads).
// Each function runs a single DB-side aggregation instead of pulling
// every row into the Node process and counting in JavaScript.
// At 1L leads this cut dashboard query time from ~15 s → < 1 s.
// ----------------------------------------------------------------
async function getDashboardData(collegeId: string) {
  const supabase = createAdminClient()
  const today = todayIST()                                   // 'YYYY-MM-DD' in IST
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  const thisMonthStr = todayIST().substring(0, 7)            // 'YYYY-MM' in IST
  const lastMonthDate = new Date()
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1)
  const lastMonthStr = lastMonthDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).substring(0, 7)

  // ---- Run all queries in parallel ----
  const [
    // Fast COUNT queries for the overview KPI cards (already efficient, kept as-is)
    { count: totalLeads },
    { count: enrolled },
    { count: coldWrong },
    { count: todayFollowUps },
    { count: staleLeads },
    { count: callsToday },
    { count: unassigned },
    { count: todayVisits },
    // Counsellor name list (small, needed for name lookup)
    { data: counsellorList },
    // SQL aggregate functions — replace the 3 full-table fetches
    { data: stageCounts },
    { data: counsellorStatsRaw },
    { data: sourceStatsRaw },
    { data: sourceStageRaw },
    { data: sourceLeadsRaw },
  ] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('college_id', collegeId).eq('is_active', true),
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('college_id', collegeId).eq('current_lead_stage', 'Enrolled').eq('is_active', true),
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('college_id', collegeId).in('current_lead_stage', ['Cold Lead', 'Wrong Lead']).eq('is_active', true),
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('college_id', collegeId).eq('follow_up_date', today).eq('is_active', true),
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('college_id', collegeId).eq('is_active', true)
      .lte('updated_at', threeDaysAgo)
      .not('current_lead_stage', 'in', '("Enrolled","Cold Lead","Wrong Lead")'),
    supabase.from('call_diary').select('*', { count: 'exact', head: true })
      .eq('college_id', collegeId).gte('created_at', today),
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('college_id', collegeId).is('assigned_to', null).eq('is_active', true),
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('college_id', collegeId).eq('visit_date', today).eq('is_active', true),

    supabase.from('users').select('id, name')
      .eq('college_id', collegeId).eq('role', 'counsellor').eq('is_active', true),

    // SQL GROUP BY → stage counts (replaces: fetch all leads → JS count per stage)
    supabase.rpc('get_stage_counts', { p_college_id: collegeId }),

    // SQL GROUP BY → counsellor stats (replaces: fetch all assigned leads → JS join)
    supabase.rpc('get_counsellor_stats', { p_college_id: collegeId, p_today: today }),

    // SQL GROUP BY → source totals + monthly trend (replaces: fetch all leads → JS group)
    supabase.rpc('get_source_stats', {
      p_college_id: collegeId,
      p_this_month: thisMonthStr,
      p_last_month: lastMonthStr,
    }),

    // SQL GROUP BY → stage distribution per source
    supabase.rpc('get_source_stage_breakdown', { p_college_id: collegeId }),

    // Window-function limited to 20 most recent leads per source
    supabase.rpc('get_source_recent_leads', { p_college_id: collegeId, p_per_source: 20 }),
  ])

  // ---- Build stageCount map ----
  const stageCountMap: Record<string, number> = {}
  ;(stageCounts || []).forEach((r: any) => { stageCountMap[r.stage] = Number(r.cnt) })

  // ---- Counsellor name lookup map ----
  const counsellorMap: Record<string, string> = {}
  ;(counsellorList || []).forEach((c: any) => { counsellorMap[c.id] = c.name })

  // ---- Build counsellorStats (join names onto SQL stats) ----
  const counsellorStatsMap: Record<string, any> = {}
  ;(counsellorStatsRaw || []).forEach((r: any) => { counsellorStatsMap[r.assigned_to] = r })

  const counsellorStats = (counsellorList || []).map((c: any) => {
    const s = counsellorStatsMap[c.id] || {}
    const assignedN   = Number(s.assigned        || 0)
    const calledN     = Number(s.called          || 0)
    const enrolledN   = Number(s.enrolled        || 0)
    return {
      id:             c.id,
      name:           c.name,
      assigned:       assignedN,
      called:         calledN,
      notCalled:      assignedN - calledN,
      interested:     Number(s.interested      || 0),
      enrolled:       enrolledN,
      conversion:     assignedN > 0 ? Math.round((enrolledN / assignedN) * 100) : 0,
      followUpsToday: Number(s.followups_today || 0),
      visitsToday:    Number(s.visits_today    || 0),
    }
  })

  // ---- Build sourceStats (merge the 3 source RPC results) ----
  const sourceStats: Record<string, {
    total: number; enrolled: number
    stages: Record<string, number>
    thisMonth: number; lastMonth: number
    leads: Array<{ id: string; name: string; phone: string; stage: string; counsellor: string; createdAt: string }>
  }> = {}

  // totals + monthly
  ;(sourceStatsRaw || []).forEach((r: any) => {
    sourceStats[r.source] = {
      total:     Number(r.total),
      enrolled:  Number(r.enrolled),
      thisMonth: Number(r.this_month),
      lastMonth: Number(r.last_month),
      stages:    {},
      leads:     [],
    }
  })

  // stage breakdown
  ;(sourceStageRaw || []).forEach((r: any) => {
    if (sourceStats[r.source]) sourceStats[r.source].stages[r.stage] = Number(r.cnt)
  })

  // recent leads drill-down (≤ 20 per source)
  ;(sourceLeadsRaw || []).forEach((r: any) => {
    if (sourceStats[r.source]) {
      sourceStats[r.source].leads.push({
        id:         r.id,
        name:       r.name || 'Unknown',
        phone:      r.phone || '',
        stage:      r.stage,
        counsellor: r.assigned_to ? (counsellorMap[r.assigned_to] || 'Unknown') : 'Unassigned',
        createdAt:  r.created_at,
      })
    }
  })

  return {
    totalLeads:    totalLeads    || 0,
    enrolled:      enrolled      || 0,
    inProgress:    (totalLeads   || 0) - (enrolled || 0) - (coldWrong || 0),
    coldWrong:     coldWrong     || 0,
    unassigned:    unassigned    || 0,
    stageCounts:   stageCountMap,
    counsellorStats,
    sourceStats,
    todayFollowUps: todayFollowUps || 0,
    staleLeads:     staleLeads     || 0,
    callsToday:     callsToday     || 0,
    todayVisits:    todayVisits    || 0,
  }
}

export default async function AdminDashboard() {
  const user = await requireAdmin()
  const data = await getDashboardData(user.college_id!)

  const stageOrder = ['New Enquiry', 'Contacted', 'Visit Scheduled', 'Visit Done', 'Application Started', 'Enrolled', 'Cold Lead', 'Wrong Lead']
  const funnelData = stageOrder.map((stage) => ({ stage, count: data.stageCounts[stage] || 0 }))

  const sourceArray = Object.entries(data.sourceStats)
    .map(([source, s]) => ({
      source,
      total:     s.total,
      enrolled:  s.enrolled,
      rate:      s.total > 0 ? Math.round((s.enrolled / s.total) * 100) : 0,
      stages:    stageOrder
        .filter((st) => s.stages[st])
        .map((st) => ({ stage: st, count: s.stages[st] })),
      thisMonth: s.thisMonth,
      lastMonth: s.lastMonth,
      leads:     s.leads.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    }))
    .sort((a, b) => b.total - a.total)

  const conversionRate = data.totalLeads > 0 ? Math.round((data.enrolled / data.totalLeads) * 100) : 0

  return (
    <div className="min-h-full bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 sm:py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Analytics Overview</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{user.name}</p>
            <p className="text-xs text-gray-500">Admin</p>
          </div>
        </div>
      </div>

      <AdminAnalyticsClient
        overview={{
          totalLeads:     data.totalLeads,
          enrolled:       data.enrolled,
          inProgress:     data.inProgress,
          coldWrong:      data.coldWrong,
          unassigned:     data.unassigned,
          conversionRate,
          callsToday:     data.callsToday,
          staleLeads:     data.staleLeads,
          todayFollowUps: data.todayFollowUps,
          todayVisits:    data.todayVisits,
        }}
        funnelData={funnelData}
        sourceData={sourceArray}
      />
    </div>
  )
}

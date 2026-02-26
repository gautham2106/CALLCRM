import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { AdminAnalyticsClient } from '@/components/admin/AdminAnalyticsClient'

async function getDashboardData(collegeId: string) {
  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalLeads }, { count: enrolled }, { count: coldWrong },
    { data: stageData }, { data: counsellorList }, { data: assignedLeads }, { data: sourceData },
    { count: todayFollowUps }, { count: staleLeads }, { count: callsToday },
    { count: unassigned }, { count: todayVisits },
  ] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('college_id', collegeId).eq('is_active', true),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('college_id', collegeId).eq('current_lead_stage', 'Enrolled'),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('college_id', collegeId).in('current_lead_stage', ['Cold Lead', 'Wrong Lead']),
    supabase.from('leads').select('current_lead_stage').eq('college_id', collegeId).eq('is_active', true),
    // Counsellors — plain select, no nested join
    supabase.from('users').select('id, name').eq('college_id', collegeId).eq('role', 'counsellor').eq('is_active', true),
    // All assigned leads for counsellor stats — separate query, joined in JS
    supabase.from('leads')
      .select('id, assigned_to, current_lead_stage, current_call_stage, visit_date, follow_up_date')
      .eq('college_id', collegeId).eq('is_active', true).not('assigned_to', 'is', null),
    supabase.from('leads').select('id, name, phone, source_name, current_lead_stage, created_at, assigned_to').eq('college_id', collegeId).eq('is_active', true),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('college_id', collegeId).eq('follow_up_date', today),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('college_id', collegeId).lte('updated_at', threeDaysAgo).not('current_lead_stage', 'in', '("Enrolled","Cold Lead","Wrong Lead")'),
    supabase.from('call_diary').select('*', { count: 'exact', head: true }).eq('college_id', collegeId).gte('created_at', today),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('college_id', collegeId).is('assigned_to', null).eq('is_active', true),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('college_id', collegeId).eq('visit_date', today).eq('is_active', true),
  ])

  const stageCounts: Record<string, number> = {}
  ;(stageData || []).forEach((l: any) => {
    stageCounts[l.current_lead_stage] = (stageCounts[l.current_lead_stage] || 0) + 1
  })

  const counsellorStats = (counsellorList || []).map((c: any) => {
    const leads = (assignedLeads || []).filter((l: any) => l.assigned_to === c.id)
    const enrolledCount = leads.filter((l: any) => l.current_lead_stage === 'Enrolled').length
    const calledCount = leads.filter((l: any) => l.current_call_stage !== null).length
    return {
      id: c.id,
      name: c.name,
      assigned: leads.length,
      called: calledCount,
      notCalled: leads.length - calledCount,
      interested: leads.filter((l: any) => l.current_call_stage === 'Interested').length,
      enrolled: enrolledCount,
      conversion: leads.length > 0 ? Math.round((enrolledCount / leads.length) * 100) : 0,
      followUpsToday: leads.filter((l: any) => l.follow_up_date === today).length,
      visitsToday: leads.filter((l: any) => l.visit_date === today).length,
    }
  })

  const counsellorMap: Record<string, string> = {}
  ;(counsellorList || []).forEach((c: any) => { counsellorMap[c.id] = c.name })

  const thisMonthStr = new Date().toISOString().substring(0, 7)
  const lastMonthDate = new Date()
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1)
  const lastMonthStr = lastMonthDate.toISOString().substring(0, 7)

  const sourceStats: Record<string, {
    total: number; enrolled: number
    stages: Record<string, number>
    thisMonth: number; lastMonth: number
    leads: Array<{ id: string; name: string; phone: string; stage: string; counsellor: string; createdAt: string }>
  }> = {}
  ;(sourceData || []).forEach((l: any) => {
    const s = l.source_name || 'Unknown'
    if (!sourceStats[s]) sourceStats[s] = { total: 0, enrolled: 0, stages: {}, thisMonth: 0, lastMonth: 0, leads: [] }
    sourceStats[s].total++
    if (l.current_lead_stage === 'Enrolled') sourceStats[s].enrolled++
    sourceStats[s].stages[l.current_lead_stage] = (sourceStats[s].stages[l.current_lead_stage] || 0) + 1
    const month = l.created_at?.substring(0, 7)
    if (month === thisMonthStr) sourceStats[s].thisMonth++
    if (month === lastMonthStr) sourceStats[s].lastMonth++
    sourceStats[s].leads.push({
      id: l.id,
      name: l.name || 'Unknown',
      phone: l.phone || '',
      stage: l.current_lead_stage,
      counsellor: l.assigned_to ? (counsellorMap[l.assigned_to] || 'Unknown') : 'Unassigned',
      createdAt: l.created_at,
    })
  })

  return {
    totalLeads: totalLeads || 0,
    enrolled: enrolled || 0,
    inProgress: (totalLeads || 0) - (enrolled || 0) - (coldWrong || 0),
    coldWrong: coldWrong || 0,
    unassigned: unassigned || 0,
    stageCounts,
    counsellorStats,
    sourceStats,
    todayFollowUps: todayFollowUps || 0,
    staleLeads: staleLeads || 0,
    callsToday: callsToday || 0,
    todayVisits: todayVisits || 0,
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
      total: s.total,
      enrolled: s.enrolled,
      rate: s.total > 0 ? Math.round((s.enrolled / s.total) * 100) : 0,
      stages: stageOrder
        .filter((st) => s.stages[st])
        .map((st) => ({ stage: st, count: s.stages[st] })),
      thisMonth: s.thisMonth,
      lastMonth: s.lastMonth,
      leads: s.leads.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
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
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
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
          totalLeads: data.totalLeads,
          enrolled: data.enrolled,
          inProgress: data.inProgress,
          coldWrong: data.coldWrong,
          unassigned: data.unassigned,
          conversionRate,
          callsToday: data.callsToday,
          staleLeads: data.staleLeads,
          todayFollowUps: data.todayFollowUps,
          todayVisits: data.todayVisits,
        }}
        funnelData={funnelData}
        sourceData={sourceArray}
      />
    </div>
  )
}

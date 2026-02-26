import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { AdminAnalyticsClient } from '@/components/admin/AdminAnalyticsClient'

async function getDashboardData(collegeId: string) {
  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalLeads }, { count: enrolled }, { count: coldWrong },
    { data: stageData }, { data: counsellorData }, { data: sourceData },
    { count: todayFollowUps }, { count: staleLeads }, { count: callsToday },
    { count: unassigned }, { count: todayVisits },
  ] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('college_id', collegeId).eq('is_active', true),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('college_id', collegeId).eq('current_lead_stage', 'Enrolled'),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('college_id', collegeId).in('current_lead_stage', ['Cold Lead', 'Wrong Lead']),
    supabase.from('leads').select('current_lead_stage').eq('college_id', collegeId).eq('is_active', true),
    supabase.from('users')
      .select('id, name, assigned_leads:leads(id, current_lead_stage, current_call_stage, visit_date, follow_up_date)')
      .eq('college_id', collegeId).eq('role', 'counsellor').eq('is_active', true),
    supabase.from('leads').select('source_name, current_lead_stage').eq('college_id', collegeId).eq('is_active', true),
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

  const counsellorStats = (counsellorData || []).map((c: any) => {
    const leads = c.assigned_leads || []
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

  const sourceStats: Record<string, { total: number; enrolled: number }> = {}
  ;(sourceData || []).forEach((l: any) => {
    const s = l.source_name || 'Unknown'
    if (!sourceStats[s]) sourceStats[s] = { total: 0, enrolled: 0 }
    sourceStats[s].total++
    if (l.current_lead_stage === 'Enrolled') sourceStats[s].enrolled++
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
        counsellorStats={data.counsellorStats}
        sourceData={sourceArray}
      />
    </div>
  )
}

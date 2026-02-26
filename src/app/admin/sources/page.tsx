import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { LeadSourcesClient } from '@/components/admin/LeadSourcesClient'

export default async function SourcesPage() {
  const user = await requireAdmin()
  const supabase = await createClient()

  const [{ data: sources }, { data: allLeads }, { data: counsellorList }] = await Promise.all([
    supabase
      .from('lead_sources')
      .select('id, source_name, is_active, created_at')
      .eq('college_id', user.college_id!)
      .order('created_at'),
    supabase
      .from('leads')
      .select('id, source_id, current_lead_stage, created_at')
      .eq('college_id', user.college_id!)
      .eq('is_active', true),
    supabase
      .from('users')
      .select('id, name')
      .eq('college_id', user.college_id!)
      .eq('role', 'counsellor'),
  ])

  const thisMonthStr = new Date().toISOString().substring(0, 7)
  const lastMonthDate = new Date()
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1)
  const lastMonthStr = lastMonthDate.toISOString().substring(0, 7)

  // Build source stats keyed by source_id; bucket null source_id as '__unknown__'
  const statsMap: Record<string, { total: number; enrolled: number; thisMonth: number; lastMonth: number; stages: Record<string, number> }> = {}
  ;(allLeads || []).forEach((l: any) => {
    const key = l.source_id || '__unknown__'
    if (!statsMap[key]) statsMap[key] = { total: 0, enrolled: 0, thisMonth: 0, lastMonth: 0, stages: {} }
    statsMap[key].total++
    if (l.current_lead_stage === 'Enrolled') statsMap[key].enrolled++
    statsMap[key].stages[l.current_lead_stage] = (statsMap[key].stages[l.current_lead_stage] || 0) + 1
    const month = l.created_at?.substring(0, 7)
    if (month === thisMonthStr) statsMap[key].thisMonth++
    if (month === lastMonthStr) statsMap[key].lastMonth++
  })

  const stageOrder = ['New Enquiry', 'Contacted', 'Visit Scheduled', 'Visit Done', 'Application Started', 'Enrolled', 'Cold Lead', 'Wrong Lead']
  const sourceStats = (sources || []).map((s: any) => {
    const stats = statsMap[s.id] || { total: 0, enrolled: 0, thisMonth: 0, lastMonth: 0, stages: {} }
    return {
      sourceId: s.id as string,
      total: stats.total,
      enrolled: stats.enrolled,
      rate: stats.total > 0 ? Math.round((stats.enrolled / stats.total) * 100) : 0,
      thisMonth: stats.thisMonth,
      lastMonth: stats.lastMonth,
      stages: stageOrder
        .filter((st) => stats.stages[st])
        .map((st) => ({ stage: st, count: stats.stages[st] })),
    }
  })

  // Unknown stat (no source_id)
  const unknownStats = statsMap['__unknown__'] || null
  const unknownStat = unknownStats ? {
    sourceId: '__unknown__',
    total: unknownStats.total,
    enrolled: unknownStats.enrolled,
    rate: unknownStats.total > 0 ? Math.round((unknownStats.enrolled / unknownStats.total) * 100) : 0,
    thisMonth: unknownStats.thisMonth,
    lastMonth: unknownStats.lastMonth,
    stages: stageOrder.filter((st) => unknownStats.stages[st]).map((st) => ({ stage: st, count: unknownStats.stages[st] })),
  } : null

  return (
    <LeadSourcesClient
      initialSources={sources || []}
      collegeId={user.college_id!}
      adminId={user.id}
      initialSourceStats={sourceStats}
      unknownStat={unknownStat}
    />
  )
}

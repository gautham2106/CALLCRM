import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrTeamLeader } from '@/lib/auth'
import { AdminLeadsClient } from '@/components/admin/AdminLeadsClient'

// Leads are no longer fetched server-side — the client fetches paginated
// pages via GET /api/admin/leads so the browser never loads 1L+ rows.
// Only small reference lists (counsellors, sources, courses) are fetched here.
export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string
    tab?: string
    stage?: string
    counsellor?: string
  }>
}) {
  const { source: initialSource, tab: initialTab, stage: initialStage, counsellor: initialCounsellor } = await searchParams
  const user = await requireAdminOrTeamLeader()
  const supabase = createAdminClient()
  const isTeamLeader = user.role === 'team_leader'

  const [
    { data: counsellors },
    { data: sources },
    { data: courses },
    { data: customFields },
    { data: schoolRows },
  ] = await Promise.all([
    (() => {
      let q = supabase
        .from('users')
        .select('id, name, email')
        .eq('college_id', user.college_id!)
        .eq('role', 'counsellor')
        .eq('is_active', true)
      if (isTeamLeader) q = q.eq('team_leader_id', user.id)
      return q
    })(),
    supabase
      .from('lead_sources')
      .select('id, source_name')
      .eq('college_id', user.college_id!)
      .eq('is_active', true),
    supabase
      .from('courses')
      .select('id, course_name')
      .eq('college_id', user.college_id!)
      .eq('is_active', true),
    supabase
      .from('custom_field_definitions')
      .select('id, field_name, field_type, is_required, dropdown_options')
      .eq('college_id', user.college_id!)
      .eq('is_active', true)
      .order('display_order'),
    supabase
      .from('leads')
      .select('school_name')
      .eq('college_id', user.college_id!)
      .not('school_name', 'is', null)
      .order('school_name'),
  ])

  // Deduplicate school names
  const schools = [...new Set((schoolRows || []).map((r: any) => r.school_name as string).filter(Boolean))].sort()

  return (
    <AdminLeadsClient
      counsellors={(counsellors || []) as any}
      sources={(sources || []) as any}
      courses={(courses || []) as any}
      customFields={(customFields || []) as any}
      schools={schools}
      collegeId={user.college_id!}
      adminId={user.id}
      userRole={user.role}
      initialSourceFilter={initialSource || 'all'}
      initialTab={(initialTab === 'visits' || initialTab === 'followups' || initialTab === 'unassigned') ? initialTab : 'all'}
      initialStageFilter={initialStage || 'all'}
      initialCounsellorFilter={initialCounsellor || 'all'}
    />
  )
}

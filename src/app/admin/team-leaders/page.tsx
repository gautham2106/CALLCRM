import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { TeamLeadersClient } from '@/components/admin/TeamLeadersClient'

export default async function TeamLeadersPage() {
  const user = await requireAdmin()
  const supabase = createAdminClient()

  const [{ data: teamLeaders }, { data: allCounsellors }] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, email, phone, is_active, created_at')
      .eq('college_id', user.college_id!)
      .eq('role', 'team_leader')
      .order('created_at', { ascending: false }),
    supabase
      .from('users')
      .select('id, name, email, is_active, team_leader_id')
      .eq('college_id', user.college_id!)
      .eq('role', 'counsellor')
      .order('name'),
  ])

  // Attach team members to each team leader
  const counsellors = allCounsellors || []
  const enriched = (teamLeaders || []).map((tl) => ({
    ...tl,
    team_members: counsellors.filter((c) => c.team_leader_id === tl.id),
  }))

  return (
    <TeamLeadersClient
      initialTeamLeaders={enriched as any}
      allCounsellors={counsellors as any}
      collegeId={user.college_id!}
    />
  )
}

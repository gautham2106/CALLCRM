import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { CounsellorsClient } from '@/components/admin/CounsellorsClient'

export default async function CounsellorsPage() {
  const user = await requireAdmin()
  const supabase = createAdminClient()

  const [{ data: counsellors }, { data: sources }, { data: unassigned }] = await Promise.all([
    supabase
      .from('users')
      .select(`
        id, name, email, phone, is_active, created_at,
        assigned_leads:leads!leads_assigned_to_fkey(
          id, current_lead_stage, current_call_stage, visit_date, follow_up_date
        )
      `)
      .eq('college_id', user.college_id!)
      .eq('role', 'counsellor')
      .order('created_at', { ascending: false }),
    supabase
      .from('lead_sources')
      .select('id, source_name')
      .eq('college_id', user.college_id!)
      .eq('is_active', true),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('college_id', user.college_id!)
      .is('assigned_to', null)
      .eq('is_active', true),
  ])

  return (
    <CounsellorsClient
      initialCounsellors={(counsellors || []) as any}
      collegeId={user.college_id!}
      adminId={user.id}
      sources={sources || []}
      unassignedCount={(unassigned as any)?.count ?? 0}
    />
  )
}

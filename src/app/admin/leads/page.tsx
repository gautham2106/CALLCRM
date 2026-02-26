import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { AdminLeadsClient } from '@/components/admin/AdminLeadsClient'

export default async function AdminLeadsPage() {
  const user = await requireAdmin()
  const supabase = createAdminClient()

  const [
    { data: leads },
    { data: counsellors },
    { data: sources },
  ] = await Promise.all([
    supabase
      .from('leads')
      .select(`
        id, name, phone, email, city, course_interest, source_name,
        current_lead_stage, current_call_stage, visit_date, follow_up_date,
        is_active, created_at, updated_at, assigned_to,
        assigned_user:users!leads_assigned_to_fkey(id, name, email)
      `)
      .eq('college_id', user.college_id!)
      .or('is_active.is.null,is_active.eq.true')
      .order('created_at', { ascending: false }),
    supabase
      .from('users')
      .select('id, name, email')
      .eq('college_id', user.college_id!)
      .eq('role', 'counsellor')
      .eq('is_active', true),
    supabase
      .from('lead_sources')
      .select('id, source_name')
      .eq('college_id', user.college_id!)
      .eq('is_active', true),
  ])

  return (
    <AdminLeadsClient
      initialLeads={(leads || []) as any}
      counsellors={(counsellors || []) as any}
      sources={(sources || []) as any}
      collegeId={user.college_id!}
      adminId={user.id}
    />
  )
}

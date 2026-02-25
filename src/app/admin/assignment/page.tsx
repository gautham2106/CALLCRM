import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { AssignmentClient } from '@/components/admin/AssignmentClient'

export default async function AssignmentPage() {
  const user = await requireAdmin()
  const supabase = await createClient()

  const [
    { data: leads },
    { data: counsellors },
  ] = await Promise.all([
    supabase
      .from('leads')
      .select(`
        id, name, phone, email, city, course_interest, source_name,
        current_lead_stage, priority, follow_up_date, assigned_to,
        assigned_user:users!leads_assigned_to_fkey(id, name)
      `)
      .eq('college_id', user.college_id!)
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('users')
      .select('id, name, email')
      .eq('college_id', user.college_id!)
      .eq('role', 'counsellor')
      .eq('is_active', true),
  ])

  return (
    <AssignmentClient
      initialLeads={(leads || []) as any}
      counsellors={(counsellors || []) as any}
      collegeId={user.college_id!}
      adminId={user.id}
    />
  )
}

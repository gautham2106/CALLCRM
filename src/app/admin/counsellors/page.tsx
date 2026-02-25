import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { CounsellorsClient } from '@/components/admin/CounsellorsClient'

export default async function CounsellorsPage() {
  const user = await requireAdmin()
  const supabase = createAdminClient()

  const { data: counsellors } = await supabase
    .from('users')
    .select(`
      id, name, email, phone, is_active, created_at,
      assigned_leads:leads!leads_assigned_to_fkey(
        id, current_lead_stage, current_call_stage
      )
    `)
    .eq('college_id', user.college_id!)
    .eq('role', 'counsellor')
    .order('created_at', { ascending: false })

  return (
    <CounsellorsClient
      initialCounsellors={counsellors || []}
      collegeId={user.college_id!}
      adminId={user.id}
    />
  )
}

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { CounsellorsClient } from '@/components/admin/CounsellorsClient'

export default async function CounsellorsPage() {
  const user = await requireAdmin()
  const supabase = createAdminClient()

  console.log('[CounsellorsPage] college_id:', user.college_id)

  const { data: counsellors, error } = await supabase
    .from('users')
    .select(`
      id, name, email, phone, is_active, created_at,
      assigned_leads:leads(
        id, current_lead_stage, current_call_stage
      )
    `)
    .eq('college_id', user.college_id!)
    .eq('role', 'counsellor')
    .order('created_at', { ascending: false })

  console.log('[CounsellorsPage] count:', counsellors?.length, 'error:', error)

  return (
    <CounsellorsClient
      initialCounsellors={counsellors || []}
      collegeId={user.college_id!}
      adminId={user.id}
    />
  )
}

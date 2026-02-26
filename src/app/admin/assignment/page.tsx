import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { AssignmentClient } from '@/components/admin/AssignmentClient'
import { LeadsTableSkeleton } from '@/components/ui/skeletons'

async function AssignmentContent({ collegeId, adminId }: { collegeId: string; adminId: string }) {
  const supabase = await createClient()
  const [
    { data: leads },
    { data: counsellors },
  ] = await Promise.all([
    supabase
      .from('leads')
      .select(`
        id, name, phone, email, city, course_interest, source_name,
        current_lead_stage, follow_up_date, assigned_to,
        assigned_user:users!leads_assigned_to_fkey(id, name)
      `)
      .eq('college_id', collegeId)
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('users')
      .select('id, name, email')
      .eq('college_id', collegeId)
      .eq('role', 'counsellor')
      .eq('is_active', true),
  ])

  return (
    <AssignmentClient
      initialLeads={(leads || []) as any}
      counsellors={(counsellors || []) as any}
      collegeId={collegeId}
      adminId={adminId}
    />
  )
}

export default async function AssignmentPage() {
  const user = await requireAdmin()

  return (
    <Suspense fallback={<LeadsTableSkeleton />}>
      <AssignmentContent collegeId={user.college_id!} adminId={user.id} />
    </Suspense>
  )
}

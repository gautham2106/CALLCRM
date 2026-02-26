import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { CounsellorDetailClient } from '@/components/admin/CounsellorDetailClient'

export default async function CounsellorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireAdmin()
  const supabase = createAdminClient()

  const [
    { data: counsellor },
    { data: leads },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, email, phone, is_active')
      .eq('id', id)
      .eq('college_id', user.college_id!)
      .eq('role', 'counsellor')
      .single(),
    supabase
      .from('leads')
      .select('id, name, phone, email, city, course_interest, source_name, current_lead_stage, current_call_stage, visit_date, follow_up_date, created_at')
      .eq('assigned_to', id)
      .eq('college_id', user.college_id!)
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
  ])

  if (!counsellor) notFound()

  return (
    <CounsellorDetailClient
      counsellor={counsellor as any}
      initialLeads={(leads || []) as any}
      collegeId={user.college_id!}
      adminId={user.id}
    />
  )
}

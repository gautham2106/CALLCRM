import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { LeadDetailClient } from '@/components/shared/LeadDetailClient'
import { notFound } from 'next/navigation'

export default async function AdminLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireAdmin()
  const supabase = createAdminClient()

  const [
    { data: lead },
    { data: callDiary },
    { data: assignmentHistory },
    { data: customFields },
    { data: customFieldValues },
    { data: counsellors },
    { data: sources },
    { data: courses },
  ] = await Promise.all([
    supabase
      .from('leads')
      .select(`
        id, name, phone, email, city, course_interest, course_id, source_id, source_name,
        current_lead_stage, current_call_stage, visit_date, follow_up_date,
        notes, is_active, created_at, updated_at, assigned_to,
        assigned_user:users!leads_assigned_to_fkey(id, name, email)
      `)
      .eq('id', id)
      .eq('college_id', user.college_id!)
      .single(),
    supabase
      .from('call_diary')
      .select(`
        id, call_stage, lead_stage_at_time, notes, follow_up_date, created_at,
        caller:users!call_diary_called_by_fkey(id, name)
      `)
      .eq('lead_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('lead_assignment_history')
      .select(`
        id, reason, created_at,
        from_user:users!lead_assignment_history_assigned_from_fkey(id, name),
        to_user:users!lead_assignment_history_assigned_to_fkey(id, name),
        by_user:users!lead_assignment_history_assigned_by_fkey(id, name)
      `)
      .eq('lead_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('custom_field_definitions')
      .select('id, field_name, field_type, dropdown_options, is_required, display_order')
      .eq('college_id', user.college_id!)
      .eq('is_active', true)
      .order('display_order'),
    supabase
      .from('custom_field_values')
      .select('field_id, value')
      .eq('lead_id', id),
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
    supabase
      .from('courses')
      .select('id, course_name')
      .eq('college_id', user.college_id!)
      .eq('is_active', true),
  ])

  if (!lead) notFound()

  const fieldValues = Object.fromEntries(
    (customFieldValues || []).map((v: { field_id: string; value: string | null }) => [v.field_id, v.value || ''])
  )

  return (
    <LeadDetailClient
      lead={lead as any}
      callDiary={(callDiary || []) as any}
      assignmentHistory={(assignmentHistory || []) as any}
      customFields={(customFields || []) as any}
      fieldValues={fieldValues}
      counsellors={(counsellors || []) as any}
      sources={(sources || []) as any}
      courses={(courses || []) as any}
      currentUserId={user.id}
      collegeId={user.college_id!}
      userRole="admin"
    />
  )
}

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { AdminLeadsClient } from '@/components/admin/AdminLeadsClient'

// Leads are no longer fetched server-side — the client fetches paginated
// pages via GET /api/admin/leads so the browser never loads 1L+ rows.
// Only small reference lists (counsellors, sources, courses) are fetched here.
export default async function AdminLeadsPage() {
  const user = await requireAdmin()
  const supabase = createAdminClient()

  const [
    { data: counsellors },
    { data: sources },
    { data: courses },
    { data: customFields },
  ] = await Promise.all([
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
    supabase
      .from('custom_field_definitions')
      .select('id, field_name, field_type, is_required, dropdown_options')
      .eq('college_id', user.college_id!)
      .eq('is_active', true)
      .order('display_order'),
  ])

  return (
    <AdminLeadsClient
      counsellors={(counsellors || []) as any}
      sources={(sources || []) as any}
      courses={(courses || []) as any}
      customFields={(customFields || []) as any}
      collegeId={user.college_id!}
      adminId={user.id}
    />
  )
}

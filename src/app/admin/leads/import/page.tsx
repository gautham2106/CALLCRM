import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { LeadImportClient } from '@/components/admin/LeadImportClient'

export default async function ImportLeadsPage() {
  const user = await requireAdmin()
  const supabase = createAdminClient()

  const [{ data: sources }, { data: counsellors }, { data: customFields }] = await Promise.all([
    supabase
      .from('lead_sources')
      .select('id, source_name')
      .eq('college_id', user.college_id!)
      .eq('is_active', true),
    supabase
      .from('users')
      .select('id, full_name')
      .eq('college_id', user.college_id!)
      .eq('role', 'counsellor')
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .from('custom_field_definitions')
      .select('id, field_name, field_type, is_required')
      .eq('college_id', user.college_id!)
      .eq('is_active', true)
      .order('display_order'),
  ])

  return (
    <LeadImportClient
      collegeId={user.college_id!}
      adminId={user.id}
      sources={sources || []}
      counsellors={counsellors || []}
      customFields={customFields || []}
    />
  )
}

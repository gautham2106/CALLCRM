import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { SuperFieldsClient } from '@/components/admin/SuperFieldsClient'

export default async function SuperFieldsPage() {
  const user = await requireAdmin()
  const supabase = await createClient()

  const { data: fields } = await supabase
    .from('custom_field_definitions')
    .select('id, field_name, field_type, dropdown_options, is_required, display_order, is_active, created_at')
    .eq('college_id', user.college_id!)
    .order('display_order')

  return (
    <SuperFieldsClient
      initialFields={fields || []}
      collegeId={user.college_id!}
      adminId={user.id}
    />
  )
}

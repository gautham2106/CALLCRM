import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { LeadImportClient } from '@/components/admin/LeadImportClient'

export default async function ImportLeadsPage() {
  const user = await requireAdmin()
  const supabase = await createClient()

  const { data: sources } = await supabase
    .from('lead_sources')
    .select('id, source_name')
    .eq('college_id', user.college_id!)
    .eq('is_active', true)

  return (
    <LeadImportClient
      collegeId={user.college_id!}
      adminId={user.id}
      sources={sources || []}
    />
  )
}

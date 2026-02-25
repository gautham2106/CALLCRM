import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { LeadSourcesClient } from '@/components/admin/LeadSourcesClient'

export default async function SourcesPage() {
  const user = await requireAdmin()
  const supabase = await createClient()

  const { data: sources } = await supabase
    .from('lead_sources')
    .select('id, source_name, is_active, created_at')
    .eq('college_id', user.college_id!)
    .order('created_at')

  return (
    <LeadSourcesClient
      initialSources={sources || []}
      collegeId={user.college_id!}
      adminId={user.id}
    />
  )
}

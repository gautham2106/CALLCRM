import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { SchoolMappingClient } from '@/components/admin/SchoolMappingClient'

export default async function SchoolMappingPage() {
  const user = await requireAdmin()
  const supabase = await createClient()

  const { data: counsellorRows } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('college_id', user.college_id!)
    .eq('role', 'counsellor')
    .order('name')

  const counsellors = (counsellorRows || []) as { id: string; name: string; email: string }[]

  return (
    <SchoolMappingClient
      counsellors={counsellors}
    />
  )
}

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { SchoolMappingClient } from '@/components/admin/SchoolMappingClient'

export default async function SchoolMappingPage() {
  const user = await requireAdmin()
  const supabase = await createClient()

  const { data: leadRows } = await supabase
    .from('leads')
    .select('school_name')
    .eq('college_id', user.college_id!)
    .eq('is_active', true)
    .not('school_name', 'is', null)

  const schoolCounts: Record<string, number> = {}
  for (const l of (leadRows || []) as { school_name: string }[]) {
    if (l.school_name) schoolCounts[l.school_name] = (schoolCounts[l.school_name] || 0) + 1
  }

  const knownSchools = Object.keys(schoolCounts).sort()

  return (
    <SchoolMappingClient
      knownSchools={knownSchools}
      schoolCounts={schoolCounts}
    />
  )
}

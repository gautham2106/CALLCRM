import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { SchoolMappingClient } from '@/components/admin/SchoolMappingClient'

export default async function SchoolMappingPage() {
  const user = await requireAdmin()
  const supabase = await createClient()

  // counsellors query: no `schools` column so it works before the migration is applied
  const [{ data: counsellorRows }, { data: schoolRows }] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, email')
      .eq('college_id', user.college_id!)
      .eq('role', 'counsellor')
      .order('name'),
    supabase
      .from('leads')
      .select('school_name')
      .eq('college_id', user.college_id!)
      .eq('is_active', true)
      .not('school_name', 'is', null),
  ])

  // schools query: separate so a failure (column not yet migrated) doesn't wipe counsellors
  const { data: schoolsData } = await supabase
    .from('users')
    .select('id, schools')
    .eq('college_id', user.college_id!)
    .eq('role', 'counsellor')

  // Count leads per school
  const schoolCounts: Record<string, number> = {}
  ;(schoolRows || []).forEach((l: { school_name: string | null }) => {
    if (l.school_name) schoolCounts[l.school_name] = (schoolCounts[l.school_name] || 0) + 1
  })

  // Flatten counsellors.schools[] into {school_name, counsellor_id} pairs
  const counsellors = (counsellorRows || []) as { id: string; name: string; email: string }[]
  const schoolsMap = new Map<string, string[]>(
    (schoolsData || []).map((c: { id: string; schools: string[] | null }) => [c.id, c.schools || []])
  )
  const mappings: { school_name: string; counsellor_id: string | null }[] = []
  for (const c of counsellors) {
    for (const school of (schoolsMap.get(c.id) || [])) {
      mappings.push({ school_name: school, counsellor_id: c.id })
    }
  }
  mappings.sort((a, b) => a.school_name.localeCompare(b.school_name))

  // All known schools = from mappings + from leads (deduplicated)
  const knownSchools = Array.from(new Set([
    ...mappings.map((m) => m.school_name),
    ...Object.keys(schoolCounts),
  ])).sort()

  return (
    <SchoolMappingClient
      initialMappings={mappings}
      counsellors={counsellors}
      knownSchools={knownSchools}
      schoolCounts={schoolCounts}
    />
  )
}

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { SchoolMappingClient } from '@/components/admin/SchoolMappingClient'

export default async function SchoolMappingPage() {
  const user = await requireAdmin()
  const supabase = await createClient()

  const [{ data: counsellorRows }, { data: leadRows }] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, email, schools')
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

  const counsellors = (counsellorRows || []) as { id: string; name: string; email: string; schools: string[] | null }[]

  const schoolCounts: Record<string, number> = {}
  for (const l of (leadRows || []) as { school_name: string }[]) {
    if (l.school_name) schoolCounts[l.school_name] = (schoolCounts[l.school_name] || 0) + 1
  }

  const mappings = counsellors.flatMap((c) =>
    (c.schools || []).map((school) => ({ school_name: school, counsellor_id: c.id }))
  ).sort((a, b) => a.school_name.localeCompare(b.school_name))

  const knownSchools = Array.from(new Set([
    ...mappings.map((m) => m.school_name),
    ...Object.keys(schoolCounts),
  ])).sort()

  return (
    <SchoolMappingClient
      initialMappings={mappings}
      counsellors={counsellors.map(({ id, name, email }) => ({ id, name, email }))}
      knownSchools={knownSchools}
      schoolCounts={schoolCounts}
    />
  )
}

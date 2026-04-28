import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { SchoolMappingClient } from '@/components/admin/SchoolMappingClient'

export default async function SchoolMappingPage() {
  const user = await requireAdmin()
  const supabase = await createClient()

  const [{ data: mappings }, { data: counsellors }, { data: schoolRows }] = await Promise.all([
    supabase
      .from('school_counsellor_mappings')
      .select('id, school_name, counsellor_id')
      .eq('college_id', user.college_id!)
      .order('school_name'),
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

  // Count leads per school from existing lead data
  const schoolCounts: Record<string, number> = {}
  ;(schoolRows || []).forEach((l: { school_name: string | null }) => {
    if (l.school_name) schoolCounts[l.school_name] = (schoolCounts[l.school_name] || 0) + 1
  })

  // All known schools = from mappings + from leads (deduplicated)
  const knownSchools = Array.from(new Set([
    ...(mappings || []).map((m: { school_name: string }) => m.school_name),
    ...Object.keys(schoolCounts),
  ])).sort()

  return (
    <SchoolMappingClient
      initialMappings={(mappings || []) as { id: string; school_name: string; counsellor_id: string | null }[]}
      counsellors={(counsellors || []) as { id: string; name: string; email: string }[]}
      knownSchools={knownSchools}
      schoolCounts={schoolCounts}
    />
  )
}

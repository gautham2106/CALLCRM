import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getAdminProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const adminSupabase = createAdminClient()
  const { data: profile } = await adminSupabase
    .from('users')
    .select('role, college_id')
    .eq('auth_id', user.id)
    .single()
  if (profile?.role !== 'admin') return null
  return { supabase: adminSupabase, profile: profile as { role: string; college_id: string } }
}

// GET — return counsellors and their assigned schools
export async function GET() {
  const ctx = await getAdminProfile()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { supabase, profile } = ctx
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, schools')
    .eq('college_id', profile.college_id)
    .eq('role', 'counsellor')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const counsellors = (data || []).map((c) => ({ id: c.id, name: c.name, email: c.email }))

  const mappings: { school_name: string; counsellor_id: string }[] = []
  for (const c of data || []) {
    for (const school of (c.schools || [])) {
      mappings.push({ school_name: school, counsellor_id: c.id })
    }
  }

  return NextResponse.json({ counsellors, mappings: mappings.sort((a, b) => a.school_name.localeCompare(b.school_name)) })
}

// POST — add schools to a counsellor
// Body: { mappings: { school_name, counsellor_id }[] }
export async function POST(request: NextRequest) {
  const ctx = await getAdminProfile()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { supabase, profile } = ctx
  const { mappings } = await request.json() as { mappings: { school_name: string; counsellor_id: string }[] }

  if (!Array.isArray(mappings) || mappings.length === 0) {
    return NextResponse.json({ error: 'mappings array is required' }, { status: 400 })
  }

  // Group schools by counsellor
  const byCounsellor = new Map<string, string[]>()
  for (const { school_name, counsellor_id } of mappings) {
    const school = school_name?.trim()
    if (!school || !counsellor_id) continue
    const list = byCounsellor.get(counsellor_id) || []
    list.push(school)
    byCounsellor.set(counsellor_id, list)
  }

  // For each counsellor, append the new schools to their existing array
  const results = await Promise.all(
    [...byCounsellor.entries()].map(async ([counsellorId, newSchools]) => {
      const { data } = await supabase
        .from('users')
        .select('schools')
        .eq('id', counsellorId)
        .eq('college_id', profile.college_id)
        .single()

      const merged = Array.from(new Set([...(data?.schools || []), ...newSchools]))
      return supabase.from('users').update({ schools: merged }).eq('id', counsellorId)
    })
  )

  const failed = results.find((r) => r.error)
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}

// DELETE — remove a school from whoever has it
// ?school=<name>
export async function DELETE(request: NextRequest) {
  const ctx = await getAdminProfile()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { supabase, profile } = ctx
  const school = request.nextUrl.searchParams.get('school')
  if (!school) return NextResponse.json({ error: 'school param required' }, { status: 400 })

  const { data } = await supabase
    .from('users')
    .select('id, schools')
    .eq('college_id', profile.college_id)
    .eq('role', 'counsellor')

  await Promise.all(
    (data || [])
      .filter((c) => (c.schools || []).includes(school))
      .map((c) =>
        supabase.from('users').update({ schools: (c.schools || []).filter((s: string) => s !== school) }).eq('id', c.id)
      )
  )

  return NextResponse.json({ ok: true })
}

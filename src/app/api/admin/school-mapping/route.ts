import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getAdminProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('role, college_id')
    .eq('auth_id', user.id)
    .single()
  if (profile?.role !== 'admin') return null
  return { supabase, profile: profile as { role: string; college_id: string } }
}

// GET /api/admin/school-mapping — flatten users.schools[] into {school_name, counsellor_id} pairs
export async function GET() {
  const ctx = await getAdminProfile()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { supabase, profile } = ctx
  const { data, error } = await supabase
    .from('users')
    .select('id, schools')
    .eq('college_id', profile.college_id)
    .eq('role', 'counsellor')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const mappings: { school_name: string; counsellor_id: string }[] = []
  for (const c of data || []) {
    for (const school of (c.schools || [])) {
      mappings.push({ school_name: school, counsellor_id: c.id })
    }
  }
  mappings.sort((a, b) => a.school_name.localeCompare(b.school_name))

  return NextResponse.json({ mappings })
}

// POST /api/admin/school-mapping — upsert mappings
// Body: { mappings: { school_name, counsellor_id | null }[] }
// Each school is moved exclusively to the specified counsellor (removed from any previous owner).
export async function POST(request: NextRequest) {
  const ctx = await getAdminProfile()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { supabase, profile } = ctx
  const body = await request.json()
  const rows: { school_name: string; counsellor_id: string | null }[] = body.mappings

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'mappings array is required' }, { status: 400 })
  }

  const { data: allCounsellors, error: fetchError } = await supabase
    .from('users')
    .select('id, schools')
    .eq('college_id', profile.college_id)
    .eq('role', 'counsellor')

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 })

  // Build mutable map of id → schools[]
  const schoolsMap = new Map<string, string[]>(
    (allCounsellors || []).map((c) => [c.id, c.schools || []])
  )

  for (const row of rows) {
    const school = row.school_name?.trim()
    if (!school) continue

    // Remove school from whoever currently owns it
    for (const [id, schools] of schoolsMap) {
      if (schools.includes(school)) schoolsMap.set(id, schools.filter((s) => s !== school))
    }

    // Add school to the new owner
    if (row.counsellor_id) {
      const current = schoolsMap.get(row.counsellor_id) || []
      if (!current.includes(school)) schoolsMap.set(row.counsellor_id, [...current, school])
    }
  }

  const results = await Promise.all(
    [...schoolsMap.entries()].map(([id, schools]) =>
      supabase.from('users').update({ schools }).eq('id', id)
    )
  )

  const failed = results.find((r) => r.error)
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/school-mapping?school=<name> — remove a school rule
export async function DELETE(request: NextRequest) {
  const ctx = await getAdminProfile()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { supabase, profile } = ctx
  const school = request.nextUrl.searchParams.get('school')
  if (!school) return NextResponse.json({ error: 'school param required' }, { status: 400 })

  const { data: counsellors, error: fetchError } = await supabase
    .from('users')
    .select('id, schools')
    .eq('college_id', profile.college_id)
    .eq('role', 'counsellor')

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 })

  const affected = (counsellors || []).filter((c) => (c.schools || []).includes(school))
  await Promise.all(
    affected.map((c) =>
      supabase
        .from('users')
        .update({ schools: (c.schools || []).filter((s: string) => s !== school) })
        .eq('id', c.id)
    )
  )

  return NextResponse.json({ ok: true })
}

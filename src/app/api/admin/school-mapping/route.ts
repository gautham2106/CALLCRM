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

// GET /api/admin/school-mapping — list all mappings for the college
export async function GET() {
  const ctx = await getAdminProfile()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { supabase, profile } = ctx
  const { data, error } = await supabase
    .from('school_counsellor_mappings')
    .select('id, school_name, counsellor_id, counsellors:users!school_counsellor_mappings_counsellor_id_fkey(id, name)')
    .eq('college_id', profile.college_id)
    .order('school_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ mappings: data || [] })
}

// POST /api/admin/school-mapping — upsert one or many mappings
// Body: { mappings: { school_name, counsellor_id | null }[] }
export async function POST(request: NextRequest) {
  const ctx = await getAdminProfile()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { supabase, profile } = ctx
  const body = await request.json()
  const rows: { school_name: string; counsellor_id: string | null }[] = body.mappings

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'mappings array is required' }, { status: 400 })
  }

  const toUpsert = rows
    .filter((r) => r.school_name?.trim())
    .map((r) => ({
      college_id: profile.college_id,
      school_name: r.school_name.trim(),
      counsellor_id: r.counsellor_id || null,
    }))

  const { error } = await supabase
    .from('school_counsellor_mappings')
    .upsert(toUpsert, { onConflict: 'college_id,school_name' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/school-mapping?id=<uuid>
export async function DELETE(request: NextRequest) {
  const ctx = await getAdminProfile()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { supabase, profile } = ctx
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('school_counsellor_mappings')
    .delete()
    .eq('id', id)
    .eq('college_id', profile.college_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

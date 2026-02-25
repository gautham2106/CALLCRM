import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
  return profile as { role: string; college_id: string }
}

// POST /api/admin/counsellors — create a new counsellor
export async function POST(request: NextRequest) {
  const profile = await getAdminProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, email, phone, password } = await request.json()
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'name, email and password are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Create Supabase Auth user using service role
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  // Insert profile row
  const { data: newUser, error: dbError } = await admin
    .from('users')
    .insert({
      name,
      email,
      phone: phone || null,
      role: 'counsellor',
      college_id: profile.college_id,
      auth_id: authData.user.id,
      is_active: true,
    })
    .select()
    .single()

  if (dbError) {
    // Roll back the auth user so we don't leave orphans
    await admin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: dbError.message }, { status: 400 })
  }

  return NextResponse.json({ user: newUser })
}

// PATCH /api/admin/counsellors — toggle is_active
export async function PATCH(request: NextRequest) {
  const profile = await getAdminProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, is_active } = await request.json()
  if (!id || is_active === undefined) {
    return NextResponse.json({ error: 'id and is_active are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('users')
    .update({ is_active })
    .eq('id', id)
    .eq('college_id', profile.college_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ user: data })
}

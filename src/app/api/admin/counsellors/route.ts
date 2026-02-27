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

  const { name, email, phone, pin } = await request.json()
  if (!name || !email || !pin) {
    return NextResponse.json({ error: 'name, email and pin are required' }, { status: 400 })
  }
  if (!/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be exactly 6 digits' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Create Supabase Auth user using service role
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: pin,
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

// PATCH /api/admin/counsellors
// Handles two operations based on body:
//   { id, is_active }                          → toggle active status
//   { id, name, email, phone?, newPin? }       → update profile + auth
export async function PATCH(request: NextRequest) {
  const profile = await getAdminProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const admin = createAdminClient()

  // --- Toggle active/inactive ---
  if (body.is_active !== undefined && body.name === undefined) {
    const { data, error } = await admin
      .from('users')
      .update({ is_active: body.is_active })
      .eq('id', id)
      .eq('college_id', profile.college_id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ user: data })
  }

  // --- Edit profile (name / email / phone / pin) ---
  const { name, email, phone, newPin } = body
  if (!name || !email) {
    return NextResponse.json({ error: 'name and email are required' }, { status: 400 })
  }
  if (newPin !== undefined && newPin !== '' && !/^\d{6}$/.test(newPin)) {
    return NextResponse.json({ error: 'New PIN must be exactly 6 digits' }, { status: 400 })
  }

  // Fetch auth_id — must belong to this college and be a counsellor
  const { data: counsellor, error: fetchError } = await admin
    .from('users')
    .select('auth_id')
    .eq('id', id)
    .eq('college_id', profile.college_id)
    .eq('role', 'counsellor')
    .single()

  if (fetchError || !counsellor) {
    return NextResponse.json({ error: 'Counsellor not found' }, { status: 404 })
  }

  // Update Supabase Auth (email always; PIN only if provided)
  const authUpdates: { email: string; password?: string } = { email }
  if (newPin) authUpdates.password = newPin

  const { error: authError } = await admin.auth.admin.updateUserById(
    counsellor.auth_id,
    authUpdates,
  )
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  // Update profile row
  const { data, error: dbError } = await admin
    .from('users')
    .update({ name, email, phone: phone || null })
    .eq('id', id)
    .eq('college_id', profile.college_id)
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 })
  return NextResponse.json({ user: data })
}

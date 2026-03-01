import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function getTeamLeaderProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('id, role, college_id')
    .eq('auth_id', user.id)
    .single()
  if (profile?.role !== 'team_leader') return null
  return profile as { id: string; role: string; college_id: string }
}

// POST /api/team-leader/counsellors — team leader creates a counsellor for their own team
export async function POST(request: NextRequest) {
  const profile = await getTeamLeaderProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, email, phone, pin } = await request.json()
  if (!name || !email || !pin) {
    return NextResponse.json({ error: 'name, email and pin are required' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
  }
  if (!/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be exactly 6 digits' }, { status: 400 })
  }
  const WEAK_PINS = new Set(['000000','111111','222222','333333','444444','555555','666666','777777','888888','999999','123456','654321'])
  if (WEAK_PINS.has(pin)) {
    return NextResponse.json({ error: 'PIN is too weak. Choose a less predictable 6-digit PIN.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: pin,
    email_confirm: true,
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  const { data: newUser, error: dbError } = await admin
    .from('users')
    .insert({
      name,
      email,
      phone: phone || null,
      role: 'counsellor',
      college_id: profile.college_id,
      team_leader_id: profile.id,
      auth_id: authData.user.id,
      is_active: true,
    })
    .select()
    .single()

  if (dbError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: dbError.message }, { status: 400 })
  }

  return NextResponse.json({ user: newUser })
}

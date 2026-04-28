import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const WEAK_PINS = new Set([
  '000000','111111','222222','333333','444444','555555',
  '666666','777777','888888','999999','123456','654321',
])

interface CounsellorRow {
  name: string
  email: string
  pin: string
  phone?: string
  school_name?: string
}

function validateRow(row: CounsellorRow): string | null {
  if (!row.name?.trim()) return 'Name is required'
  if (!row.email?.trim()) return 'Email is required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) return 'Invalid email format'
  if (!row.pin?.trim()) return 'PIN is required'
  if (!/^\d{6}$/.test(row.pin.trim())) return 'PIN must be exactly 6 digits'
  if (WEAK_PINS.has(row.pin.trim())) return 'PIN is too weak'
  return null
}

// POST /api/admin/counsellors/bulk
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, college_id')
    .eq('auth_id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { counsellors } = await request.json() as { counsellors: CounsellorRow[] }
  if (!Array.isArray(counsellors) || counsellors.length === 0) {
    return NextResponse.json({ error: 'counsellors array is required' }, { status: 400 })
  }
  if (counsellors.length > 200) {
    return NextResponse.json({ error: 'Maximum 200 counsellors per import' }, { status: 400 })
  }

  const admin = createAdminClient()

  const results = await Promise.all(
    counsellors.map(async (row) => {
      const validationError = validateRow(row)
      if (validationError) {
        return { name: row.name || '', email: row.email || '', id: null, school_name: row.school_name || null, success: false, error: validationError }
      }

      const name = row.name.trim()
      const email = row.email.trim().toLowerCase()
      const pin = row.pin.trim()
      const phone = row.phone?.trim() || null
      const school_name = row.school_name?.trim() || null

      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email,
        password: pin,
        email_confirm: true,
      })

      if (authError) {
        return { name, email, id: null, school_name, success: false, error: authError.message }
      }

      const { data: newUser, error: dbError } = await admin
        .from('users')
        .insert({
          name,
          email,
          phone,
          role: 'counsellor',
          college_id: profile.college_id,
          auth_id: authData.user.id,
          is_active: true,
        })
        .select('id')
        .single()

      if (dbError) {
        await admin.auth.admin.deleteUser(authData.user.id)
        return { name, email, id: null, school_name, success: false, error: dbError.message }
      }

      // Save school mapping if provided
      if (school_name && newUser?.id) {
        await admin
          .from('school_counsellor_mappings')
          .upsert(
            { college_id: profile.college_id, school_name, counsellor_id: newUser.id },
            { onConflict: 'college_id,school_name' }
          )
      }

      return { name, email, id: newUser?.id ?? null, school_name, success: true, error: null }
    })
  )

  return NextResponse.json({ results })
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// POST /api/admin/leads — create a single lead
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id, role, college_id')
    .eq('auth_id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { name, phone, email, city, course_interest, source_id, source_name, notes, assigned_to, visit_date } = body

  if (!name || !phone) {
    return NextResponse.json({ error: 'name and phone are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Prevent duplicate phone numbers within the same college
  const { data: existing } = await admin
    .from('leads')
    .select('id, name')
    .eq('college_id', profile.college_id)
    .eq('phone', phone)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (existing) {
    return NextResponse.json(
      { error: `A lead with this phone number already exists: "${existing.name}"` },
      { status: 409 }
    )
  }

  const { data: lead, error } = await admin
    .from('leads')
    .insert({
      name,
      phone,
      email: email || null,
      city: city || null,
      course_interest: course_interest || null,
      source_id: source_id || null,
      source_name: source_name || null,
      notes: notes || null,
      assigned_to: assigned_to || null,
      visit_date: visit_date || null,
      college_id: profile.college_id,
      created_by: profile.id,
      current_lead_stage: 'New Enquiry',
    })
    .select(`
      id, name, phone, email, city, course_interest, source_name,
      current_lead_stage, current_call_stage, visit_date, follow_up_date,
      is_active, created_at, updated_at, assigned_to,
      assigned_user:users!leads_assigned_to_fkey(id, name, email)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ lead })
}

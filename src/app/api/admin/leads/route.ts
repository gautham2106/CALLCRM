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
  const { name, email, city, course_interest, course_id, source_id, source_name, notes, assigned_to, visit_date } = body
  // Normalize phone: trim whitespace so "9876543210" and " 9876543210 " are treated the same
  const phone: string = (body.phone ?? '').trim()

  if (!name || !phone) {
    return NextResponse.json({ error: 'name and phone are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Prevent duplicate phone numbers within the same college.
  // Use .limit(1) before .maybeSingle() so PostgREST never sees multiple rows
  // (which would cause maybeSingle to error rather than return the existing lead).
  // Do NOT filter by is_active — leads imported without that flag have is_active = null
  // and would be missed, allowing silent duplicates.
  const { data: existing, error: dupError } = await admin
    .from('leads')
    .select('id, name, phone')
    .eq('college_id', profile.college_id)
    .eq('phone', phone)
    .limit(1)
    .maybeSingle()

  console.log('[leads/POST] dup check', { college_id: profile.college_id, phone, found: existing?.name ?? null, dupError: dupError?.message ?? null })

  if (existing) {
    return NextResponse.json(
      { error: `A lead with this phone number already exists: "${existing.name}"` },
      { status: 409 }
    )
  }
  if (dupError) {
    return NextResponse.json({ error: dupError.message }, { status: 500 })
  }

  const { data: lead, error } = await admin
    .from('leads')
    .insert({
      name,
      phone,
      email: email || null,
      city: city || null,
      course_interest: course_interest || null,
      course_id: course_id || null,
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
      id, name, phone, email, city, course_interest, course_id, source_name,
      current_lead_stage, current_call_stage, visit_date, follow_up_date,
      is_active, created_at, updated_at, assigned_to,
      assigned_user:users!leads_assigned_to_fkey(id, name, email)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ lead })
}

// DELETE /api/admin/leads — permanently delete one or more leads
export async function DELETE(request: NextRequest) {
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

  const { ids } = await request.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('leads')
    .delete()
    .in('id', ids)
    .eq('college_id', profile.college_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: ids.length })
}

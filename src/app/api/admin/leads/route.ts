import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// GET /api/admin/leads — paginated, server-side filtered lead list
// Query params:
//   page        number  (default 0)
//   limit       number  (default 50)
//   search      string  name/phone/email/city ilike
//   stage       string  current_lead_stage exact match
//   counsellor  string  assigned_to UUID, or 'unassigned'
//   source      string  source_name exact match, or '__none__'
//   course      string  course_id UUID, or '__none__'
//   tab         string  'unassigned' | 'visits' | 'followups' (overdue)
//   export      'true'  skips pagination limit — returns all matching rows for CSV
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('id, role, college_id').eq('auth_id', user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'team_leader')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const sp = new URL(request.url).searchParams

  const isExport   = sp.get('export') === 'true'
  const page       = Math.max(0, parseInt(sp.get('page')  || '0'))
  const limit      = Math.min(200, Math.max(1, parseInt(sp.get('limit') || '50')))
  // Sanitize search: strip PostgREST filter operators and limit length
  const rawSearch  = (sp.get('search') || '').trim().slice(0, 200)
  const search     = rawSearch.replace(/[()[\]{}<>|&!]/g, '')
  const stage      = sp.get('stage')      || ''
  const counsellor = sp.get('counsellor') || ''
  const source     = sp.get('source')     || ''   // source_name value or '__none__'
  const course     = sp.get('course')     || ''   // course_id or '__none__'
  const tab        = sp.get('tab')        || ''   // 'unassigned'

  // For team leaders, resolve their counsellors first so we can scope leads
  let teamCounsellorIds: string[] | null = null
  if (profile.role === 'team_leader') {
    const { data: myCounsellors } = await admin
      .from('users')
      .select('id')
      .eq('college_id', profile.college_id)
      .eq('role', 'counsellor')
      .eq('team_leader_id', profile.id)
      .eq('is_active', true)
    teamCounsellorIds = (myCounsellors || []).map((c: { id: string }) => c.id)
  }

  let query = admin
    .from('leads')
    .select(`
      id, name, phone, email, city, school_name, course_interest, course_id, source_name,
      current_lead_stage, current_call_stage, visit_date, follow_up_date,
      is_active, created_at, updated_at, assigned_to,
      assigned_user:users!leads_assigned_to_fkey(id, name, email)
    `, { count: 'exact' })
    .eq('college_id', profile.college_id)
    .or('is_active.is.null,is_active.eq.true')
    .order('created_at', { ascending: false })

  // Team leaders can only see leads belonging to their counsellors
  if (teamCounsellorIds !== null) {
    if (teamCounsellorIds.length === 0) {
      // No counsellors → return empty
      return NextResponse.json({ leads: [], total: 0, unassigned_total: 0, visits_overdue_total: 0, followups_overdue_total: 0 })
    }
    query = query.in('assigned_to', teamCounsellorIds)
  }

  const isIdsOnly = sp.get('ids_only') === 'true'
  const school    = sp.get('school')   || ''   // school_name value

  const EMPTY_SCOPE = ['00000000-0000-0000-0000-000000000000']
  const scopeIds = teamCounsellorIds !== null
    ? (teamCounsellorIds.length === 0 ? EMPTY_SCOPE : teamCounsellorIds)
    : null

  // For tab=followups we need the missed-followup IDs before building the range
  // (a call must have been logged on/after follow_up_date for it to count as done)
  let missedFollowupIds: string[] | null = null
  if (tab === 'followups') {
    const { data: rows } = await admin.rpc('get_missed_followup_ids', {
      p_college_id: profile.college_id,
      p_counsellor_ids: scopeIds ?? null,
    })
    missedFollowupIds = (rows || []).map((r: { id: string }) => r.id)
    if (missedFollowupIds.length === 0) {
      return NextResponse.json({ leads: [], total: 0, unassigned_total: 0, visits_overdue_total: 0, followups_overdue_total: 0 })
    }
  }

  // Apply server-side pagination (skipped for export and ids_only)
  if (!isExport && !isIdsOnly) query = query.range(page * limit, page * limit + limit - 1)

  // Filters
  if (tab === 'visits') {
    // Overdue visits: visit_date is in the past and lead is still "Visit Scheduled"
    // (not marked as Visit Done or No Show) — needs counsellor follow-up
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    query = query
      .eq('current_lead_stage', 'Visit Scheduled')
      .not('visit_date', 'is', null)
      .lt('visit_date', todayStr)
  } else if (tab === 'followups') {
    // Missed follow-ups: follow_up_date passed AND no call logged since then
    query = query.in('id', missedFollowupIds!)
  } else if (tab === 'unassigned' || counsellor === 'unassigned') {
    query = query.is('assigned_to', null)
  } else if (counsellor) {
    // Validate the counsellor belongs to this team leader's team
    if (teamCounsellorIds !== null && !teamCounsellorIds.includes(counsellor)) {
      return NextResponse.json({ leads: [], total: 0, unassigned_total: 0 })
    }
    query = query.eq('assigned_to', counsellor)
  }
  if (stage)              query = query.eq('current_lead_stage', stage)
  if (source === '__none__') query = query.is('source_name', null)
  else if (source)        query = query.eq('source_name', source)
  if (course === '__none__') query = query.is('course_id', null)
  else if (course)        query = query.eq('course_id', course)
  if (school)             query = query.eq('school_name', school)
  if (search) {
    query = query.or(
      `name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,city.ilike.%${search}%`
    )
  }

  // ids_only=true — return just IDs for "Select All Matching" across all pages
  if (isIdsOnly) {
    const { data: idRows } = await query.select('id')
    return NextResponse.json({ ids: (idRows || []).map((r: { id: string }) => r.id) })
  }

  // Unassigned count for tab badge (separate fast COUNT query)
  const unassignedCountPromise = admin
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('college_id', profile.college_id)
    .is('assigned_to', null)
    .or('is_active.is.null,is_active.eq.true')

  // Visits overdue count: visit_date passed but still "Visit Scheduled"
  const todayForCount = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

  let visitsOverdueQuery = admin
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('college_id', profile.college_id)
    .eq('current_lead_stage', 'Visit Scheduled')
    .not('visit_date', 'is', null)
    .lt('visit_date', todayForCount)
    .or('is_active.is.null,is_active.eq.true')
  if (scopeIds) visitsOverdueQuery = visitsOverdueQuery.in('assigned_to', scopeIds)

  // Missed follow-ups count: follow_up_date passed AND no call logged since then
  // If we already fetched the IDs above (tab=followups), reuse the count
  const followupsOverduePromise: Promise<number> = missedFollowupIds !== null
    ? Promise.resolve(missedFollowupIds.length)
    : admin.rpc('get_missed_followup_ids', {
        p_college_id: profile.college_id,
        p_counsellor_ids: scopeIds ?? null,
      }).then(({ data: rows }) => (rows || []).length)

  const [
    { data, count, error },
    { count: unassignedTotal },
    { count: visitsOverdueTotal },
    followupsOverdueTotal,
  ] = await Promise.all([
    query,
    unassignedCountPromise,
    visitsOverdueQuery,
    followupsOverduePromise,
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // When exporting, also fetch custom field definitions and values for all leads
  if (isExport && data && data.length > 0) {
    const leadIds = (data as { id: string }[]).map((l) => l.id)
    const [{ data: fieldDefs }, { data: fieldValues }] = await Promise.all([
      admin
        .from('custom_field_definitions')
        .select('id, field_name, display_order')
        .eq('college_id', profile.college_id)
        .eq('is_active', true)
        .order('display_order'),
      admin
        .from('custom_field_values')
        .select('lead_id, field_id, value')
        .in('lead_id', leadIds),
    ])
    return NextResponse.json({
      leads: data || [],
      total: count || 0,
      unassigned_total: unassignedTotal || 0,
      visits_overdue_total: visitsOverdueTotal || 0,
      followups_overdue_total: followupsOverdueTotal || 0,
      custom_field_definitions: fieldDefs || [],
      custom_field_values: fieldValues || [],
    })
  }

  return NextResponse.json({
    leads: data || [],
    total: count || 0,
    unassigned_total: unassignedTotal || 0,
    visits_overdue_total: visitsOverdueTotal || 0,
    followups_overdue_total: followupsOverdueTotal || 0,
  })
}

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
  const { name, email, city, school_name, course_interest, course_id, source_id, source_name, notes, assigned_to, visit_date } = body
  // Normalize phone: trim whitespace so "9876543210" and " 9876543210 " are treated the same
  const phone: string = (body.phone ?? '').trim()

  if (!name || !phone) {
    return NextResponse.json({ error: 'name and phone are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Validate course_id belongs to this college (if provided)
  if (course_id) {
    const { data: courseRow } = await admin
      .from('courses')
      .select('id')
      .eq('id', course_id)
      .eq('college_id', profile.college_id)
      .single()
    if (!courseRow) {
      return NextResponse.json({ error: 'Invalid course_id' }, { status: 400 })
    }
  }

  // Validate source_id belongs to this college (if provided)
  if (source_id) {
    const { data: sourceRow } = await admin
      .from('lead_sources')
      .select('id')
      .eq('id', source_id)
      .eq('college_id', profile.college_id)
      .single()
    if (!sourceRow) {
      return NextResponse.json({ error: 'Invalid source_id' }, { status: 400 })
    }
  }

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
      school_name: school_name || null,
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
      id, name, phone, email, city, school_name, course_interest, course_id, source_name,
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

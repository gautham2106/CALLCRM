import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// POST /api/admin/assign — assign or reassign leads to a counsellor
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

  const { leadIds, counsellorId, reason, isReassign } = await request.json()
  if (!leadIds?.length || !counsellorId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch current assignment state for history
  const { data: currentLeads } = await admin
    .from('leads')
    .select('id, name, assigned_to')
    .in('id', leadIds)
    .eq('college_id', profile.college_id)

  if (!currentLeads?.length) {
    return NextResponse.json({ error: 'No leads found' }, { status: 404 })
  }

  // Update leads
  const { error: updateError } = await admin
    .from('leads')
    .update({ assigned_to: counsellorId, updated_at: new Date().toISOString() })
    .in('id', leadIds)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Insert assignment history
  const historyRows = currentLeads.map((lead) => ({
    lead_id: lead.id,
    college_id: profile.college_id,
    assigned_from: lead.assigned_to || null,
    assigned_to: counsellorId,
    assigned_by: profile.id,
    reason: reason || null,
  }))
  await admin.from('lead_assignment_history').insert(historyRows)

  // Insert notification (uses admin client to bypass RLS on notifications)
  if (leadIds.length === 1) {
    await admin.from('notifications').insert({
      user_id: counsellorId,
      college_id: profile.college_id,
      type: isReassign ? 'reassigned' : 'new_lead',
      message: `${isReassign ? 'Lead reassigned to you' : 'New lead assigned'}: ${currentLeads[0].name}`,
      lead_id: leadIds[0],
    })
  } else {
    await admin.from('notifications').insert({
      user_id: counsellorId,
      college_id: profile.college_id,
      type: 'bulk_leads',
      message: `${leadIds.length} leads ${isReassign ? 'reassigned' : 'assigned'} to you`,
      bulk_count: leadIds.length,
    })
  }

  return NextResponse.json({ success: true })
}

// POST /api/admin/assign/distribute — auto-distribute leads round-robin
export async function PATCH(request: NextRequest) {
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

  const { leadIds, counsellors } = await request.json()
  if (!leadIds?.length || !counsellors?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: currentLeads } = await admin
    .from('leads')
    .select('id, name, assigned_to')
    .in('id', leadIds)
    .eq('college_id', profile.college_id)

  if (!currentLeads?.length) {
    return NextResponse.json({ error: 'No leads found' }, { status: 404 })
  }

  // Round-robin assignment
  const assignments: Record<string, string[]> = {}
  leadIds.forEach((id: string, idx: number) => {
    const counsellor = counsellors[idx % counsellors.length]
    if (!assignments[counsellor.id]) assignments[counsellor.id] = []
    assignments[counsellor.id].push(id)
  })

  for (const [counsellorId, ids] of Object.entries(assignments)) {
    await admin
      .from('leads')
      .update({ assigned_to: counsellorId, updated_at: new Date().toISOString() })
      .in('id', ids)

    const batchLeads = currentLeads.filter((l) => ids.includes(l.id))
    const historyRows = batchLeads.map((lead) => ({
      lead_id: lead.id,
      college_id: profile.college_id,
      assigned_from: lead.assigned_to || null,
      assigned_to: counsellorId,
      assigned_by: profile.id,
      reason: 'Auto-distributed',
    }))
    await admin.from('lead_assignment_history').insert(historyRows)

    await admin.from('notifications').insert({
      user_id: counsellorId,
      college_id: profile.college_id,
      type: 'bulk_leads',
      message: `${ids.length} leads auto-assigned to you`,
      bulk_count: ids.length,
    })
  }

  return NextResponse.json({ success: true })
}

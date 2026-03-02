import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/leads/[id] — update a single lead's fields and custom field values.
// Used by LeadDetailClient and LeadSlidePanel instead of direct Supabase PATCH
// calls, which fail with 500 when PostgREST's schema cache is stale (a common
// issue after adding new columns via migrations).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id, role, college_id')
    .eq('auth_id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = profile.role === 'admin' || profile.role === 'team_leader'
  const isCounsellor = profile.role === 'counsellor'
  if (!isAdmin && !isCounsellor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Verify the lead belongs to this college (and for counsellors, is assigned to them)
  const leadQuery = admin
    .from('leads')
    .select('id, phone, college_id, assigned_to')
    .eq('id', id)
    .eq('college_id', profile.college_id)

  const { data: existing, error: fetchErr } = await leadQuery.single()
  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  // Counsellors can only update leads assigned to them
  if (isCounsellor && existing.assigned_to !== profile.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()

  // Fields any authenticated user with access can update
  const updatePayload: Record<string, unknown> = {}
  const allowedFields = [
    'email', 'city', 'school_name', 'course_interest', 'course_id',
    'current_lead_stage', 'current_call_stage', 'visit_date', 'follow_up_date', 'notes',
  ]
  for (const field of allowedFields) {
    if (field in body) updatePayload[field] = body[field] ?? null
  }

  // Admin-only fields
  if (isAdmin) {
    const adminFields = ['name', 'phone', 'source_id', 'source_name']
    for (const field of adminFields) {
      if (field in body) updatePayload[field] = body[field] ?? null
    }

    // Duplicate phone check if phone is being changed
    if ('phone' in body && body.phone && body.phone.trim() !== existing.phone) {
      const { data: dup } = await admin
        .from('leads')
        .select('id, name')
        .eq('college_id', profile.college_id)
        .eq('phone', body.phone.trim())
        .neq('id', id)
        .limit(1)
        .maybeSingle()
      if (dup) {
        return NextResponse.json(
          { error: `Phone already used by "${dup.name}"` },
          { status: 409 }
        )
      }
    }
    if (updatePayload.phone) {
      updatePayload.phone = String(updatePayload.phone).trim()
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error } = await admin
    .from('leads')
    .update(updatePayload)
    .eq('id', id)
    .eq('college_id', profile.college_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Upsert custom field values if provided
  const { customFields } = body as { customFields?: Record<string, string | null> }
  if (customFields && typeof customFields === 'object') {
    for (const [fieldId, value] of Object.entries(customFields)) {
      const { error: cfErr } = await admin
        .from('custom_field_values')
        .upsert(
          {
            lead_id: id,
            field_id: fieldId,
            college_id: profile.college_id,
            value: value || null,
            updated_by: profile.id,
          },
          { onConflict: 'lead_id,field_id' }
        )
      if (cfErr) {
        console.error('[leads/PATCH] custom field upsert error:', cfErr.message)
      }
    }
  }

  return NextResponse.json({ ok: true })
}

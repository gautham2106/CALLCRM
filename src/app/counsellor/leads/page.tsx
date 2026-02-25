import { createClient } from '@/lib/supabase/server'
import { requireCounsellor } from '@/lib/auth'
import { CounsellorLeadsClient } from '@/components/counsellor/CounsellorLeadsClient'

export default async function CounsellorLeadsPage() {
  const user = await requireCounsellor()
  const supabase = await createClient()

  const { data: leads } = await supabase
    .from('leads')
    .select(`
      id, name, phone, email, city, course_interest, source_name,
      current_lead_stage, current_call_stage, priority, follow_up_date,
      is_active, created_at, updated_at
    `)
    .eq('assigned_to', user.id)
    .eq('is_active', true)
    .order('follow_up_date', { ascending: true, nullsFirst: false })

  return (
    <CounsellorLeadsClient
      initialLeads={leads || []}
      counsellorId={user.id}
    />
  )
}

import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { requireCounsellor } from '@/lib/auth'
import { CounsellorLeadsClient } from '@/components/counsellor/CounsellorLeadsClient'
import { LeadsTableSkeleton } from '@/components/ui/skeletons'

async function LeadsContent({ userId }: { userId: string }) {
  const supabase = await createClient()
  const { data: leads } = await supabase
    .from('leads')
    .select(`
      id, name, phone, email, city, course_interest, source_name,
      current_lead_stage, current_call_stage, visit_date, follow_up_date,
      is_active, created_at, updated_at
    `)
    .eq('assigned_to', userId)
    .eq('is_active', true)
    .order('follow_up_date', { ascending: true, nullsFirst: false })

  return (
    <CounsellorLeadsClient
      initialLeads={(leads || []) as any}
      counsellorId={userId}
    />
  )
}

export default async function CounsellorLeadsPage() {
  const user = await requireCounsellor()

  return (
    <Suspense fallback={<LeadsTableSkeleton />}>
      <LeadsContent userId={user.id} />
    </Suspense>
  )
}

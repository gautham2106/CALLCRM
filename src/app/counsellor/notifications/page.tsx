import { createClient } from '@/lib/supabase/server'
import { requireCounsellor } from '@/lib/auth'
import { NotificationsClient } from '@/components/counsellor/NotificationsClient'

export default async function NotificationsPage() {
  const user = await requireCounsellor()
  const supabase = await createClient()

  const { data: notifications } = await supabase
    .from('notifications')
    .select(`
      id, type, message, lead_id, bulk_count, is_read, created_at,
      lead:leads!notifications_lead_id_fkey(id, name, phone)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <NotificationsClient
      initialNotifications={(notifications || []) as any}
      userId={user.id}
    />
  )
}

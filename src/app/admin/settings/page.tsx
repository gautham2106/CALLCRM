import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { AdminSettingsClient } from '@/components/admin/AdminSettingsClient'

export default async function SettingsPage() {
  const user = await requireAdmin()
  const supabase = await createClient()

  const { data: college } = await supabase
    .from('colleges')
    .select('id, name, email, phone, address, subscription_plan')
    .eq('id', user.college_id!)
    .single()

  return <AdminSettingsClient college={college} currentUser={user} />
}

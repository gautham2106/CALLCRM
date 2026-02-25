import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  if (profile?.role === 'admin') {
    redirect('/admin')
  } else if (profile?.role === 'counsellor') {
    redirect('/counsellor')
  } else {
    redirect('/auth/login')
  }
}

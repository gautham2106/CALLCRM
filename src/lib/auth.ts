import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { UserProfile } from '@/types/database'

export async function getUser(): Promise<UserProfile | null> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', user.id)
    .single()

  return profile as UserProfile | null
}

export async function requireAuth(role?: 'admin' | 'counsellor'): Promise<UserProfile> {
  const user = await getUser()

  if (!user) {
    redirect('/auth/login')
  }

  if (role && user.role !== role) {
    if (user.role === 'admin') {
      redirect('/admin')
    } else {
      redirect('/counsellor')
    }
  }

  return user
}

export async function requireAdmin(): Promise<UserProfile> {
  return requireAuth('admin')
}

export async function requireCounsellor(): Promise<UserProfile> {
  return requireAuth('counsellor')
}

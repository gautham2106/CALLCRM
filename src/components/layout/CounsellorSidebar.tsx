'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Bell,
  LogOut,
  GraduationCap,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const navItems = [
  { href: '/counsellor', label: 'My Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/counsellor/leads', label: 'My Leads', icon: Users },
  { href: '/counsellor/notifications', label: 'Notifications', icon: Bell },
]

interface Props {
  onClose?: () => void
}

export function CounsellorSidebar({ onClose }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const fetchUnreadCount = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.id).single()
      if (!profile) return
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('is_read', false)
      setUnreadCount(count || 0)
    }

    fetchUnreadCount()

    const channel = supabase
      .channel('notifications-sidebar')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        fetchUnreadCount()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside className="w-64 min-h-screen bg-gray-950 text-white flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-white leading-none">CallCRM</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Counsellor Portal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest px-3 pb-2">Navigation</p>
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)
          const isNotifs = item.label === 'Notifications'
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-white' : 'text-gray-500')} />
              <span className="flex-1">{item.label}</span>
              {isNotifs && unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              {isActive && !isNotifs && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
            </Link>
          )
        })}
      </nav>

      {/* Sign Out */}
      <div className="px-3 pb-4 border-t border-gray-800 pt-3">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-all w-full"
        >
          <LogOut className="h-[18px] w-[18px] text-gray-500 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}

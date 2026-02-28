'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Sliders,
  Tags,
  Settings,
  LogOut,
  GraduationCap,
  ChevronRight,
  BookOpen,
  Shuffle,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const ALL_NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', teamLeaderLabel: 'My Team', icon: LayoutDashboard, exact: true, roles: ['admin', 'team_leader'] },
  { href: '/admin/leads', label: 'Leads', icon: Users, roles: ['admin', 'team_leader'] },
  { href: '/admin/assignment', label: 'Auto-Distribute', icon: Shuffle, roles: ['admin'] },
  { href: '/admin/counsellors', label: 'Counsellors', icon: UserCheck, roles: ['admin', 'team_leader'] },
  { href: '/admin/team-leaders', label: 'Team Leaders', icon: Shield, roles: ['admin'] },
  { href: '/admin/super-fields', label: 'Super Fields', icon: Sliders, roles: ['admin'] },
  { href: '/admin/sources', label: 'Lead Sources', icon: Tags, roles: ['admin'] },
  { href: '/admin/courses', label: 'Courses', icon: BookOpen, roles: ['admin'] },
  { href: '/admin/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
]

interface Props {
  onClose?: () => void
  userRole?: string
}

export function AdminSidebar({ onClose, userRole = 'admin' }: Props) {
  const navItems = ALL_NAV_ITEMS.filter((item) => item.roles.includes(userRole))
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

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
            <p className="text-[11px] text-gray-500 mt-0.5">Admission Management</p>
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
              <span className="flex-1">
                {userRole === 'team_leader' && item.teamLeaderLabel ? item.teamLeaderLabel : item.label}
              </span>
              {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
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

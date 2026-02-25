'use client'

import { Bell, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface TopBarProps {
  title: string
  userName?: string
  userRole?: string
  showNotifications?: boolean
  unreadCount?: number
}

export function TopBar({ title, userName, userRole, showNotifications, unreadCount = 0 }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <div className="flex items-center gap-4">
          {showNotifications && (
            <Link href="/counsellor/notifications">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </Link>
          )}
          {userName && (
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{userName}</p>
              <p className="text-xs text-gray-500 capitalize">{userRole}</p>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

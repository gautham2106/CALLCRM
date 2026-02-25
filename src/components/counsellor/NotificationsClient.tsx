'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/use-toast'
import { formatDateTime } from '@/lib/utils'
import {
  Bell,
  UserPlus,
  Users,
  RefreshCw,
  CheckCheck,
} from 'lucide-react'

interface Notification {
  id: string
  type: string
  message: string
  lead_id: string | null
  bulk_count: number | null
  is_read: boolean
  created_at: string
  lead: { id: string; name: string; phone: string } | null
}

interface Props {
  initialNotifications: Notification[]
  userId: string
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  new_lead: UserPlus,
  bulk_leads: Users,
  reassigned: RefreshCw,
}

const TYPE_COLORS: Record<string, string> = {
  new_lead: 'text-blue-600 bg-blue-50',
  bulk_leads: 'text-purple-600 bg-purple-50',
  reassigned: 'text-orange-600 bg-orange-50',
}

export function NotificationsClient({ initialNotifications, userId }: Props) {
  const supabase = createClient()
  const [notifications, setNotifications] = useState(initialNotifications)
  const unreadCount = notifications.filter((n) => !n.is_read).length

  useEffect(() => {
    // Mark all as read when page opens
    markAllRead()

    // Subscribe to new notifications
    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const newNotif = payload.new as Notification
          setNotifications((prev) => [newNotif, ...prev])
          toast({
            title: 'New notification',
            description: newNotif.message,
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)
    if (unreadIds.length === 0) return

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds)

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const markOneRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
  }

  return (
    <div className="p-6 max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <Badge className="bg-red-500 text-white">{unreadCount} new</Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const Icon = TYPE_ICONS[notif.type] || Bell
            const colorClass = TYPE_COLORS[notif.type] || 'text-gray-600 bg-gray-50'

            return (
              <div
                key={notif.id}
                className={`bg-white border rounded-xl p-4 flex items-start gap-4 transition-all ${
                  !notif.is_read ? 'border-blue-200 shadow-sm' : 'border-gray-100'
                }`}
                onClick={() => !notif.is_read && markOneRead(notif.id)}
              >
                <div className={`p-2 rounded-lg shrink-0 ${colorClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!notif.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                    {notif.message}
                  </p>
                  {notif.lead && (
                    <Link
                      href={`/counsellor/leads/${notif.lead.id}`}
                      className="text-xs text-blue-600 hover:underline mt-1 block"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View lead: {notif.lead.name} ({notif.lead.phone})
                    </Link>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{formatDateTime(notif.created_at)}</p>
                </div>
                {!notif.is_read && (
                  <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

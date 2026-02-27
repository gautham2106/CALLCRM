'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

async function subscribeAndSave() {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidKey) {
    console.error('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set — rebuild the app after adding the env var')
    return
  }

  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  const sub = existing ?? await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  })
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  })
}

interface Props {
  className?: string
  /** Show a text label alongside the icon (for sidebar placement) */
  label?: boolean
}

export function PushNotificationButton({ className, label = false }: Props) {
  const [permission, setPermission] = useState<NotificationPermission | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return
    const perm = Notification.permission
    setPermission(perm)
    // Silently re-subscribe on mount if already granted
    if (perm === 'granted') {
      subscribeAndSave().catch(() => {})
    }
  }, [])

  if (permission === null) return null

  const handleClick = async () => {
    if (permission === 'granted') {
      toast({ title: 'Push notifications are active', description: "You'll be alerted for new leads and follow-ups." })
      return
    }
    if (permission === 'denied') {
      toast({
        title: 'Notifications blocked by browser',
        description: 'Open your browser site settings and allow notifications for this site, then refresh.',
        variant: 'destructive',
      })
      return
    }
    setLoading(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result === 'granted') {
        await subscribeAndSave()
        localStorage.removeItem('push_banner_dismissed')
        toast({ title: 'Notifications enabled!', description: "You'll receive alerts for new leads and today's follow-ups." })
      }
    } catch {
      toast({ title: 'Could not enable notifications', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const isActive = permission === 'granted'

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={className}
      title={isActive ? 'Push notifications are on' : 'Enable push notifications'}
    >
      {isActive
        ? <Bell className="h-[18px] w-[18px] text-green-400 shrink-0" />
        : <BellOff className="h-[18px] w-[18px] text-gray-500 shrink-0" />
      }
      {label && (
        <span className="flex-1 text-left">
          {isActive ? 'Notifications On' : 'Enable Notifications'}
        </span>
      )}
    </button>
  )
}

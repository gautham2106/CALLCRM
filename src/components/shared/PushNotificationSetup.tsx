'use client'

import { useState, useEffect } from 'react'
import { todayIST } from '@/lib/utils'
import { Bell, BellOff, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  todayFollowUps: number
  todayVisits: number
}

const STORAGE_KEY = 'push_banner_dismissed'
const REMINDER_KEY = 'push_daily_reminder'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function PushNotificationSetup({ todayFollowUps, todayVisits }: Props) {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [dismissed, setDismissed] = useState(true) // start hidden, reveal after check
  const [enabling, setEnabling] = useState(false)

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return

    const currentPermission = Notification.permission
    setPermission(currentPermission)

    // Show banner only if permission not yet granted and user hasn't dismissed
    const isDismissed = !!localStorage.getItem(STORAGE_KEY)
    setDismissed(isDismissed || currentPermission === 'denied')

    // If already granted, register SW silently and fire daily reminder
    if (currentPermission === 'granted') {
      registerAndSubscribe().then(() => fireDailyReminder(todayFollowUps, todayVisits))
    }
  }, [todayFollowUps, todayVisits])

  const handleEnable = async () => {
    setEnabling(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result === 'granted') {
        await registerAndSubscribe()
        fireDailyReminder(todayFollowUps, todayVisits)
        setDismissed(true)
      } else {
        setDismissed(true)
        localStorage.setItem(STORAGE_KEY, '1')
      }
    } finally {
      setEnabling(false)
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem(STORAGE_KEY, '1')
  }

  // Don't render anything once dismissed or if notifications not supported
  if (dismissed || typeof window === 'undefined' || !('Notification' in window)) return null
  if (permission === 'granted') return null

  return (
    <div className="mx-4 sm:mx-6 mt-4 flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
      <Bell className="h-4 w-4 text-blue-600 shrink-0" />
      <span className="flex-1 text-blue-800 font-medium">
        Enable notifications to get alerts for new leads, follow-ups and visits
      </span>
      <Button
        size="sm"
        className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shrink-0"
        onClick={handleEnable}
        disabled={enabling}
      >
        <Bell className="h-3.5 w-3.5" />
        {enabling ? 'Enabling...' : 'Enable'}
      </Button>
      <button
        onClick={handleDismiss}
        className="p-1 rounded hover:bg-blue-100 text-blue-400 shrink-0"
        title="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

async function registerAndSubscribe() {
  try {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      console.error('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set — rebuild the app after adding the env var')
      return
    }

    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    await navigator.serviceWorker.ready

    const existing = await registration.pushManager.getSubscription()
    const subscription = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    })
  } catch (err) {
    console.error('[push] registration failed:', err)
  }
}

function fireDailyReminder(followUps: number, visits: number) {
  if (followUps === 0 && visits === 0) return

  // Only fire once per day per device
  const today = todayIST()
  const lastFired = localStorage.getItem(REMINDER_KEY)
  if (lastFired === today) return

  const parts: string[] = []
  if (followUps > 0) parts.push(`${followUps} follow-up${followUps > 1 ? 's' : ''}`)
  if (visits > 0) parts.push(`${visits} visit${visits > 1 ? 's' : ''}`)

  navigator.serviceWorker.ready.then((reg) => {
    reg.showNotification("Today's Schedule — CALLCRM", {
      body: parts.join(' and ') + ' scheduled for today',
      icon: '/favicon.ico',
      tag: 'daily-reminder',
      data: { url: '/counsellor' },
    })
    localStorage.setItem(REMINDER_KEY, today)
  }).catch(() => {
    // Fallback: plain Notification if SW not ready
    new Notification("Today's Schedule — CALLCRM", {
      body: parts.join(' and ') + ' scheduled for today',
    })
    localStorage.setItem(REMINDER_KEY, today)
  })
}

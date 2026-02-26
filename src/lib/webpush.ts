import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:admin@callcrm.app',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
}

/**
 * Send a push notification to a single subscription.
 * Returns 'expired' if the subscription is gone (should be deleted from DB).
 */
export async function sendPush(
  subscription: webpush.PushSubscription,
  payload: PushPayload
): Promise<boolean | 'expired'> {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
    return true
  } catch (err: unknown) {
    const e = err as { statusCode?: number }
    if (e.statusCode === 410 || e.statusCode === 404) return 'expired'
    console.error('[webpush] send failed:', e)
    return false
  }
}

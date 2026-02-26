// CALLCRM Service Worker — handles push notifications

self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title || 'CALLCRM', {
      body: data.body || '',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: data.tag || 'callcrm',
      requireInteraction: false,
      data: { url: data.url || '/counsellor' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/counsellor'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab if open
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus()
        }
      }
      // Open new tab
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})

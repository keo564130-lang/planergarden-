// Service worker for PWA notification support
self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim())
})

// Listen for push notifications from the server
self.addEventListener('push', (event) => {
  let title = 'Планер задач'
  let options = {
    body: 'Пора выполнять задачу!',
    icon: '/icon-192.png',
    badge: '/icon-192.png'
  }

  if (event.data) {
    try {
      const data = event.data.json()
      title = data.title || title
      options = { ...options, ...data.options, icon: '/icon-192.png', badge: '/icon-192.png' }
    } catch (e) {
      options.body = event.data.text()
    }
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Open the app when notification is tapped
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      return clients.openWindow('/')
    })
  )
})

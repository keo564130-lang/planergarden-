// Service worker for PWA notification support
self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim())
})

// Listen for push notifications if we connect a backend push server in the future
self.addEventListener('push', (event) => {
  let title = 'Планер задач'
  let options = {
    body: 'Пора выполнять задачу!',
    icon: '/favicon.ico',
    badge: '/favicon.ico'
  }

  if (event.data) {
    try {
      const data = event.data.json()
      title = data.title || title
      options = { ...options, ...data.options }
    } catch (e) {
      options.body = event.data.text()
    }
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Service worker for PWA notification support + Share Target
self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim())
})

// Handle Web Share Target POST
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  
  // Intercept share target POST requests
  if (url.pathname === '/' && url.searchParams.has('share') && event.request.method === 'POST') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData()
        const title = formData.get('title') || ''
        const text = formData.get('text') || ''
        const shareUrl = formData.get('url') || ''
        
        // Collect shared photos
        const photos = []
        const photoFiles = formData.getAll('photos')
        for (const file of photoFiles) {
          if (file && file.size > 0) {
            const base64 = await fileToBase64(file)
            if (base64) photos.push(base64)
          }
        }
        
        // Store share data in IndexedDB for the app to pick up
        const shareData = { title, text: text + (shareUrl ? '\n' + shareUrl : ''), photos, timestamp: Date.now() }
        
        // Use a BroadcastChannel to notify the app
        const channel = new BroadcastChannel('share-target')
        channel.postMessage(shareData)
        channel.close()
        
        // Also store in cache as fallback
        const cache = await caches.open('share-target-cache')
        await cache.put('/_share_data', new Response(JSON.stringify(shareData)))
        
        // Redirect to app
        return Response.redirect('/?shared=1', 303)
      } catch (err) {
        return Response.redirect('/', 303)
      }
    })())
    return
  }
})

// Convert File to base64 data URI
function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

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

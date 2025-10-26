// 🔔 Service Worker per Push Notifications
// Questo file gestisce le notifiche push quando l'app è in background

const CACHE_NAME = 'jacopo-chat-push-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/admin.html',
  '/icons/icon-192x192.svg',
  '/icons/icon-72x72.svg'
];

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache opened');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Push event - Gestisce le notifiche push
self.addEventListener('push', (event) => {
  console.log('🔔 Push received:', event);
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Jacopo Chat', body: event.data.text() };
    }
  }
  
  const options = {
    body: data.body || 'Nuovo messaggio da Admin',
    icon: '/icons/icon-192x192.svg',
    badge: '/icons/icon-72x72.svg',
    tag: 'jacopo-chat',
    requireInteraction: true,
    vibrate: [200, 100, 200],
    actions: [
      {
        action: 'open',
        title: 'Apri Chat',
        icon: '/icons/icon-72x72.svg'
      },
      {
        action: 'close',
        title: 'Chiudi',
        icon: '/icons/icon-72x72.svg'
      }
    ],
    data: data
  };
  
  console.log('🔔 Showing notification:', options);
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Jacopo Chat', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event);
  
  event.notification.close();
  
  if (event.action === 'open') {
    // Apri l'app
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // Se c'è già una finestra aperta, portala in primo piano
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Altrimenti apri una nuova finestra
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  } else if (event.action === 'close') {
    // Chiudi la notifica
    console.log('🔔 Notification closed');
  } else {
    // Default action - apri l'app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Background sync per messaggi offline
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync:', event.tag);
  
  if (event.tag === 'message-sync') {
    event.waitUntil(
      // Sincronizza messaggi offline
      syncOfflineMessages()
    );
  }
});

// Funzione per sincronizzare messaggi offline
async function syncOfflineMessages() {
  try {
    // Recupera messaggi offline dal cache
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match('/offline-messages');
    
    if (response) {
      const messages = await response.json();
      console.log('📤 Syncing offline messages:', messages);
      
      // Invia messaggi al server
      for (const message of messages) {
        try {
          await fetch('/api/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(message)
          });
        } catch (error) {
          console.error('Error syncing message:', error);
        }
      }
      
      // Rimuovi messaggi sincronizzati
      await cache.delete('/offline-messages');
    }
  } catch (error) {
    console.error('Background sync error:', error);
  }
}

// Fetch event - Cache strategy
self.addEventListener('fetch', (event) => {
  // Don't cache WebSocket connections
  if (event.request.url.includes('/ws')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});

console.log('🔔 Push Service Worker loaded');

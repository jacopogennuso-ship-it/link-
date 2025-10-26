const CACHE_NAME = 'jacopo-chat-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/admin.html',
  '/manifest.json'
];

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache opened');
        // Add files one by one to handle missing files gracefully
        return Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(url).catch(err => {
              console.log(`Failed to cache ${url}:`, err);
              return null;
            })
          )
        );
      })
      .then(() => {
        console.log('Service Worker installed');
        return self.skipWaiting();
      })
      .catch(err => {
        console.log('Service Worker install failed:', err);
        return self.skipWaiting();
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
    }).then(() => {
      console.log('Service Worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  // Don't cache WebSocket connections
  if (event.request.url.includes('/ws')) {
    return;
  }
  
  // Don't cache admin connections
  if (event.request.url.includes('/admin')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request).catch(err => {
          console.log('Fetch failed:', err);
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Push event for notifications
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);
  
  let notificationData = {
    title: 'Jacopo Chat',
    body: 'Nuovo messaggio ricevuto',
    icon: '/icons/icon-192x192.svg',
    badge: '/icons/icon-72x72.svg'
  };
  
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || 'Jacopo Chat',
        body: data.body || 'Nuovo messaggio ricevuto',
        icon: data.icon || '/icons/icon-192x192.svg',
        badge: '/icons/icon-72x72.svg'
      };
    } catch (e) {
      console.log('Push data is not JSON:', e);
      notificationData.body = event.data.text();
    }
  }
  
  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
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
    requireInteraction: true,
    silent: false
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification click received:', event);
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // Check if there's already a window/tab open with the target URL
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // If no existing window, open a new one
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Background sync for offline messages
self.addEventListener('sync', (event) => {
  console.log('Background sync:', event.tag);
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  return new Promise((resolve) => {
    console.log('Performing background sync...');
    resolve();
  });
}

// Service Worker per mantenere attiva l'app in background
const CACHE_NAME = 'camera-stream-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html'
      ]);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Mantieni attivo il Service Worker
let keepAliveInterval;

self.addEventListener('message', (event) => {
  if (event.data === 'KEEP_ALIVE') {
    // Resetta l'intervallo ogni volta che riceviamo un messaggio
    clearInterval(keepAliveInterval);
    keepAliveInterval = setInterval(() => {
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage('PING');
        });
      });
    }, 20000);
  }
});

// Gestisci le fetch per mantenere l'app funzionante offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
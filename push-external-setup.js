// 🔔 Push Notifications con Servizio Esterno
// Configurazione per OneSignal (gratuito e facile)

// 1. VAPID Keys (genera su https://vapidkeys.com/)
const VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY_HERE';
const VAPID_PRIVATE_KEY = 'YOUR_VAPID_PRIVATE_KEY_HERE';

// 2. OneSignal Configuration
const ONESIGNAL_APP_ID = 'YOUR_ONESIGNAL_APP_ID';
const ONESIGNAL_REST_API_KEY = 'YOUR_ONESIGNAL_REST_API_KEY';

// 3. Client-side: Service Worker per Push
const serviceWorkerCode = `
// Service Worker per Push Notifications
self.addEventListener('push', function(event) {
  console.log('Push received:', event);
  
  const options = {
    body: event.data ? event.data.text() : 'Nuovo messaggio',
    icon: '/icons/icon-192x192.svg',
    badge: '/icons/icon-72x72.svg',
    tag: 'jacopo-chat',
    requireInteraction: true,
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
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Jacopo Chat', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('Notification clicked:', event);
  
  if (event.action === 'open') {
    event.notification.close();
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    event.notification.close();
  } else {
    // Default action
    event.notification.close();
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
`;

// 4. Server-side: Invia Push tramite OneSignal
const sendPushNotification = async (playerId, title, message, data = {}) => {
  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_player_ids: [playerId],
        headings: { en: title },
        contents: { en: message },
        data: data,
        small_icon: '/icons/icon-72x72.svg',
        large_icon: '/icons/icon-192x192.svg',
        android_accent_color: '25d366',
        android_led_color: '25d366',
        android_visibility: 1,
        priority: 10
      })
    });
    
    const result = await response.json();
    console.log('Push sent:', result);
    return result;
  } catch (error) {
    console.error('Push error:', error);
    return null;
  }
};

// 5. Client-side: Subscribe to Push
const subscribeToPush = async () => {
  try {
    // Check if service worker is supported
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker not supported');
      return null;
    }
    
    // Check if push is supported
    if (!('PushManager' in window)) {
      console.log('Push not supported');
      return null;
    }
    
    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw-push.js');
    console.log('Service Worker registered:', registration);
    
    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: VAPID_PUBLIC_KEY
    });
    
    console.log('Push subscription:', subscription);
    
    // Send subscription to server
    await fetch('/subscribe-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subscription: subscription,
        room: localStorage.getItem('clientRoom')
      })
    });
    
    return subscription;
  } catch (error) {
    console.error('Push subscription error:', error);
    return null;
  }
};

// 6. Server endpoint per subscription
app.post('/subscribe-push', (req, res) => {
  const { subscription, room } = req.body;
  
  // Salva subscription nel database o file
  const subscriptions = JSON.parse(fs.readFileSync('./data/push-subscriptions.json', 'utf8') || '{}');
  subscriptions[room] = subscription;
  fs.writeFileSync('./data/push-subscriptions.json', JSON.stringify(subscriptions, null, 2));
  
  console.log(`Push subscription saved for room: ${room}`);
  res.json({ success: true });
});

// 7. Invia push quando admin manda messaggio
const sendPushToClient = async (room, title, message) => {
  try {
    const subscriptions = JSON.parse(fs.readFileSync('./data/push-subscriptions.json', 'utf8') || '{}');
    const subscription = subscriptions[room];
    
    if (subscription) {
      await sendPushNotification(subscription.endpoint, title, message, {
        room: room,
        timestamp: Date.now()
      });
      console.log(`Push sent to room ${room}`);
    } else {
      console.log(`No subscription found for room ${room}`);
    }
  } catch (error) {
    console.error('Error sending push:', error);
  }
};

module.exports = {
  sendPushNotification,
  subscribeToPush,
  sendPushToClient
};

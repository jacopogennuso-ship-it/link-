// Push Notifications Configuration
// Per implementare notifiche push reali, servono:

// 1. VAPID Keys (per autenticazione)
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa40HIePvQ8vK8eJg5vH8vK8eJg5vH8vK8eJg5vH8vK8eJg5vH8vK8eJg5vH8'; // Sostituire con chiave reale

// 2. Push Service URL
const PUSH_SERVICE_URL = 'https://fcm.googleapis.com/fcm/send'; // Google FCM

// 3. Server Key (per inviare notifiche)
const SERVER_KEY = 'YOUR_SERVER_KEY_HERE'; // Sostituire con chiave reale

// 4. Configurazione per diversi browser
const PUSH_CONFIG = {
  // Chrome/Edge
  chrome: {
    endpoint: 'https://fcm.googleapis.com/fcm/send',
    key: VAPID_PUBLIC_KEY
  },
  
  // Firefox
  firefox: {
    endpoint: 'https://updates.push.services.mozilla.com/wpush/v2',
    key: VAPID_PUBLIC_KEY
  },
  
  // Safari
  safari: {
    endpoint: 'https://web.push.apple.com',
    key: VAPID_PUBLIC_KEY
  }
};

// 5. Funzione per registrare il service worker con push
async function registerPushService() {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);
      
      // Richiedi permessi per le notifiche
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('✅ Notification permission granted');
        
        // Sottoscrivi alle notifiche push
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        
        console.log('Push subscription:', subscription);
        
        // Invia la subscription al server
        await sendSubscriptionToServer(subscription);
        
        return subscription;
      } else {
        console.log('❌ Notification permission denied');
        return null;
      }
    } catch (error) {
      console.error('Error registering push service:', error);
      return null;
    }
  } else {
    console.log('❌ Push notifications not supported');
    return null;
  }
}

// 6. Funzione per convertire VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// 7. Funzione per inviare subscription al server
async function sendSubscriptionToServer(subscription) {
  try {
    const response = await fetch('/api/push-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscription: subscription,
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      })
    });
    
    if (response.ok) {
      console.log('✅ Push subscription sent to server');
    } else {
      console.error('❌ Failed to send subscription to server');
    }
  } catch (error) {
    console.error('Error sending subscription to server:', error);
  }
}

// 8. Funzione per inviare notifiche push dal server
async function sendPushNotification(subscription, payload) {
  try {
    const response = await fetch('/api/send-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${SERVER_KEY}`
      },
      body: JSON.stringify({
        to: subscription.endpoint,
        notification: {
          title: payload.title,
          body: payload.body,
          icon: payload.icon || '/icons/icon-192x192.svg',
          badge: '/icons/icon-72x72.svg',
          click_action: payload.click_action || '/',
          require_interaction: true
        },
        data: payload.data || {}
      })
    });
    
    if (response.ok) {
      console.log('✅ Push notification sent');
    } else {
      console.error('❌ Failed to send push notification');
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

// 9. Esporta le funzioni per l'uso
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    registerPushService,
    sendSubscriptionToServer,
    sendPushNotification,
    PUSH_CONFIG
  };
} else {
  // Browser environment
  window.PushConfig = {
    registerPushService,
    sendSubscriptionToServer,
    sendPushNotification,
    PUSH_CONFIG
  };
}

// 10. Istruzioni per implementazione:
/*
1. Genera VAPID keys:
   npm install -g web-push
   web-push generate-vapid-keys

2. Configura il server con le chiavi VAPID

3. Implementa gli endpoint:
   - POST /api/push-subscription (per ricevere subscription)
   - POST /api/send-push (per inviare notifiche)

4. Aggiorna il service worker per gestire le notifiche push

5. Testa con diversi browser e dispositivi
*/

# 🔔 Push Notifications Esterni - Jacopo Chat

## ❌ **Problema Attuale**
- Le notifiche sono solo **in-app** (popup nell'app)
- Non funzionano quando l'app è **in background**
- Non sono **notifiche del sistema** del telefono

## ✅ **Soluzione: OneSignal**

OneSignal è **gratuito** e facile da configurare per le notifiche push.

### **1. 🚀 Setup OneSignal**

#### **Passo 1: Crea Account OneSignal**
1. Vai su [OneSignal.com](https://onesignal.com)
2. Crea un account gratuito
3. Crea una nuova app "Jacopo Chat"

#### **Passo 2: Configurazione Web Push**
1. **App Settings** → **Web Push**
2. **Site Name**: Jacopo Chat
3. **Site URL**: `http://localhost:3000` (o il tuo dominio)
4. **Default Notification Icon**: `/icons/icon-192x192.svg`

#### **Passo 3: Ottieni le Chiavi**
1. **App Settings** → **Keys & IDs**
2. Copia:
   - **App ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - **REST API Key**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### **2. 🔧 Configurazione Server**

#### **Installa Dipendenze:**
```bash
npm install web-push
```

#### **Server (`server.js`):**
```javascript
const webpush = require('web-push');

// OneSignal Configuration
const ONESIGNAL_APP_ID = 'YOUR_ONESIGNAL_APP_ID';
const ONESIGNAL_REST_API_KEY = 'YOUR_ONESIGNAL_REST_API_KEY';

// VAPID Keys (genera su https://vapidkeys.com/)
const VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY';
const VAPID_PRIVATE_KEY = 'YOUR_VAPID_PRIVATE_KEY';

// Configure VAPID
webpush.setVapidDetails(
  'mailto:your-email@example.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Store subscriptions
const subscriptions = new Map(); // room -> subscription

// Endpoint per subscription
app.post('/subscribe-push', (req, res) => {
  const { subscription, room } = req.body;
  
  // Salva subscription
  subscriptions.set(room, subscription);
  
  // Salva su file
  const subs = Object.fromEntries(subscriptions);
  fs.writeFileSync('./data/push-subscriptions.json', JSON.stringify(subs, null, 2));
  
  console.log(`📱 Push subscription saved for room: ${room}`);
  res.json({ success: true });
});

// Invia push notification
async function sendPushNotification(room, title, message) {
  try {
    const subscription = subscriptions.get(room);
    if (!subscription) {
      console.log(`❌ No subscription found for room: ${room}`);
      return;
    }
    
    const payload = JSON.stringify({
      title: title,
      body: message,
      icon: '/icons/icon-192x192.svg',
      badge: '/icons/icon-72x72.svg',
      tag: 'jacopo-chat',
      requireInteraction: true,
      data: {
        room: room,
        timestamp: Date.now()
      }
    });
    
    await webpush.sendNotification(subscription, payload);
    console.log(`📤 Push sent to room ${room}: ${message}`);
  } catch (error) {
    console.error('Push error:', error);
  }
}
```

### **3. 📱 Configurazione Client**

#### **Client (`index.html`):**
```javascript
// VAPID Public Key (stesso del server)
const VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY';

// Subscribe to push notifications
async function subscribeToPush() {
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
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
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
        room: room
      })
    });
    
    console.log('✅ Push subscription sent to server');
    return subscription;
  } catch (error) {
    console.error('Push subscription error:', error);
    return null;
  }
}

// Convert VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Request permission and subscribe
async function requestPushPermission() {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('✅ Notification permission granted');
      await subscribeToPush();
    } else {
      console.log('❌ Notification permission denied');
    }
  } catch (error) {
    console.error('Permission request error:', error);
  }
}

// Call when app starts
requestPushPermission();
```

### **4. 🔄 Integrazione con Chat**

#### **Server: Invia Push quando Admin manda messaggio**
```javascript
// Nel server.js, quando admin manda messaggio
if(ws.role==='admin'){
  const targetRoom = data.room || ws.selectedRoom;
  if(targetRoom && clients.has(targetRoom)){
    // ... invia messaggio al client ...
    
    // Invia push notification
    sendPushNotification(targetRoom, 'Nuovo messaggio da Admin', message.text);
  }
}
```

### **5. 🧪 Test delle Notifiche**

#### **Per Testare:**
1. **Apri l'app** in browser
2. **Accetta le notifiche** quando richiesto
3. **Manda un messaggio** da admin
4. **Minimizza l'app** (o chiudi il tab)
5. **Verifica** che arrivi la notifica del sistema

#### **Debug:**
- Controlla **Console** per log di subscription
- Verifica **OneSignal Dashboard** per statistiche
- Controlla **Service Worker** in DevTools

### **6. 🚀 Deploy Produzione**

#### **Per Deploy:**
1. **Cambia URL** in OneSignal da `localhost` al tuo dominio
2. **Aggiorna VAPID keys** se necessario
3. **Testa** su dispositivo reale
4. **Monitora** statistiche su OneSignal

## 🎯 **Risultati Attesi**

### **✅ Notifiche Reali:**
- **Notifiche del sistema** quando app è in background
- **Suono e vibrazione** del telefono
- **Click per aprire** l'app
- **Persistenti** fino a quando non vengono lette

### **✅ Funzionalità:**
- **Push automatiche** quando admin manda messaggi
- **Riconnessione** quando si clicca la notifica
- **Offline support** con background sync
- **Cross-platform** (Android, iOS, Desktop)

## 🚨 **Note Importanti**

1. **HTTPS Richiesto**: Le push notifications funzionano solo su HTTPS
2. **Service Worker**: Deve essere registrato correttamente
3. **VAPID Keys**: Devono essere generate e configurate
4. **OneSignal**: Account gratuito con limiti ragionevoli
5. **Testing**: Testa su dispositivo reale, non solo browser

## 🔧 **Troubleshooting**

### **Notifiche non arrivano:**
- Verifica **permission** nel browser
- Controlla **Service Worker** registrato
- Verifica **VAPID keys** corrette
- Controlla **OneSignal** configuration

### **Subscription fallisce:**
- Verifica **HTTPS** (richiesto per push)
- Controlla **VAPID keys** formato corretto
- Verifica **Service Worker** path corretto

### **Notifiche non persistenti:**
- Controlla **tag** nelle notifiche
- Verifica **requireInteraction** true
- Controlla **actions** configurate

Ora avrai **vere notifiche push** del sistema! 🔔

# 🚀 Deploy Server - Jacopo Chat

## 📦 **Dipendenze per Deploy**

### **package.json aggiornato:**
```json
{
  "name": "bg-camera",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": { "start": "node server.js" },
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.14.2",
    "multer": "^1.4.5-lts.1",
    "web-push": "^3.6.6"
  }
}
```

## 🔧 **Setup Server**

### **1. Installazione Dipendenze:**
```bash
npm install
```

### **2. VAPID Keys Configurate:**
```javascript
// server.js - Già configurate
const VAPID_PUBLIC_KEY = 'BB8FYQIMEa7-25gltUu85BZY5plHQt962LWvr4EztI2oChOCzDA5rmdRl8HF3s7psoyynwRche6Fwue3AYuvfhU';
const VAPID_PRIVATE_KEY = 'IUuMBnSYPtSdKf1l-VrKHhxF2yfzw1IUGsQR5fh1P0c';

webpush.setVapidDetails(
  'mailto:jacopo.gennuso@gmail.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);
```

### **3. File di Configurazione:**
- ✅ **server.js** - Server principale con push notifications
- ✅ **index.html** - Client con supporto iOS
- ✅ **admin.html** - Admin dashboard
- ✅ **sw-push.js** - Service Worker per push
- ✅ **manifest.json** - PWA manifest
- ✅ **icons/** - Icone PWA

## 🍎 **Supporto iOS**

### **✅ Funzionalità iOS Implementate:**
- **Rilevamento iOS** automatico
- **Istruzioni installazione PWA** per iOS
- **Banner di aiuto** per notifiche iOS
- **Supporto PWA** completo

### **🔔 Notifiche iOS:**
1. **Installa come PWA** (Condividi → Aggiungi alla schermata Home)
2. **Apri da schermata Home** (non da Safari)
3. **Abilita notifiche** in Impostazioni → Notifiche
4. **Testa** le notifiche push

## 🚀 **Deploy Steps**

### **1. Render.com:**
```bash
# Nel terminale del server
npm install
npm start
```

### **2. Variabili Ambiente (se necessario):**
```bash
PORT=3000
NODE_ENV=production
```

### **3. File Necessari:**
- ✅ `server.js` - Server principale
- ✅ `package.json` - Dipendenze
- ✅ `index.html` - Client
- ✅ `admin.html` - Admin
- ✅ `sw-push.js` - Service Worker
- ✅ `manifest.json` - PWA
- ✅ `icons/` - Icone
- ✅ `uploads/` - Directory upload
- ✅ `data/` - Directory dati

## 🔧 **Funzionalità Complete**

### **✅ Server:**
- **WebSocket** per comunicazione real-time
- **Push notifications** con VAPID
- **File upload** con multer
- **Chat history** persistente
- **Room management** con ID univoci

### **✅ Client:**
- **PWA** installabile
- **Push notifications** del sistema
- **localStorage** per persistenza
- **iOS support** con istruzioni
- **Auto-reconnect** con heartbeat

### **✅ Admin:**
- **Dashboard** responsive
- **Camera control** per client
- **Chat** con allegati
- **Room selection** dinamica
- **Session persistence** con localStorage

## 🎯 **Test Post-Deploy**

### **1. Test Base:**
- ✅ Apri `https://your-domain.com`
- ✅ Login client funziona
- ✅ Login admin funziona
- ✅ Chat funziona

### **2. Test Push Notifications:**
- ✅ Accetta notifiche quando richiesto
- ✅ Manda messaggio da admin
- ✅ Verifica notifica arriva al client
- ✅ Test su iOS (installa come PWA)

### **3. Test iOS:**
- ✅ Rilevamento iOS automatico
- ✅ Banner installazione PWA
- ✅ Istruzioni notifiche iOS
- ✅ Test notifiche su PWA installata

## 🚨 **Note Importanti**

### **1. HTTPS Richiesto:**
- Push notifications funzionano solo su **HTTPS**
- Render.com fornisce HTTPS automatico

### **2. iOS Limitazioni:**
- Notifiche funzionano solo su **PWA installate**
- Safari mobile ha supporto limitato
- Istruzioni automatiche per utenti iOS

### **3. VAPID Keys:**
- Già configurate e funzionanti
- Nessuna configurazione aggiuntiva necessaria

## 🎉 **Risultato Finale**

### **✅ App Completa:**
- **Surveillance system** funzionante
- **Push notifications** reali del sistema
- **PWA** installabile su tutti i dispositivi
- **iOS support** con istruzioni automatiche
- **Persistenza** completa chat e sessioni
- **Admin dashboard** responsive

### **✅ Deploy Ready:**
- Tutte le dipendenze nel `package.json`
- VAPID keys configurate
- File di configurazione completi
- Supporto iOS implementato
- Test automatici per iOS

Ora puoi fare il deploy sul server! 🚀

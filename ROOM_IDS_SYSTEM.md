# 🏠 Sistema ID Stanze Unici - Jacopo Chat

## ✅ **Problemi Risolti**

### **1. 👨‍💼 Admin Vede Solo Messaggi del Client**
- **Problema**: L'admin non riceveva i propri messaggi nella cronologia
- **Soluzione**: Aggiunto invio dei messaggi admin all'admin stesso
- **Risultato**: Admin vede tutti i messaggi (client + admin)

### **2. 📱 Client Perde Chat in Background**
- **Problema**: Client perdeva tutti i messaggi quando andava in background
- **Soluzione**: Implementato localStorage per persistenza messaggi
- **Risultato**: Chat persistente anche dopo disconnessione

### **3. 🏠 Sistema ID Stanze Unici**
- **Problema**: Mancava identificazione univoca delle stanze
- **Soluzione**: Implementato sistema ID univoci con persistenza
- **Risultato**: Riconnessione automatica con ID salvati

## 🚀 **Sistema Implementato**

### **1. 🏠 Identificativi Stanze Unici**

#### **Server (`server.js`):**
```javascript
// Room management functions
function generateRoomId() {
  return 'room_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function createRoom(roomName) {
  const roomId = generateRoomId();
  const roomData = {
    id: roomId,
    name: roomName,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString()
  };
  
  console.log(`🏠 Created room: ${roomName} with ID: ${roomId}`);
  return { roomId, roomData };
}
```

#### **Caratteristiche:**
- ✅ **ID univoci** per ogni stanza
- ✅ **Timestamp** di creazione e ultima attività
- ✅ **Persistenza** su file JSON
- ✅ **Metadati** completi per ogni stanza

### **2. 💾 Persistenza Server**

#### **File di Storage:**
- `./data/chat-history.json` - Cronologia messaggi
- `./data/rooms-data.json` - Dati stanze con ID

#### **Funzioni di Persistenza:**
```javascript
// Load rooms data from file
function loadRoomsData() {
  if (fs.existsSync(ROOMS_DATA_FILE)) {
    const data = JSON.parse(fs.readFileSync(ROOMS_DATA_FILE, 'utf8'));
    roomData.clear();
    Object.entries(data).forEach(([room, roomInfo]) => {
      roomData.set(room, roomInfo);
      rooms.add(room);
    });
  }
}

// Save rooms data to file
function saveRoomsData() {
  const data = Object.fromEntries(roomData);
  fs.writeFileSync(ROOMS_DATA_FILE, JSON.stringify(data, null, 2));
}
```

#### **Salvataggio Automatico:**
- ✅ **All'avvio**: Carica dati esistenti
- ✅ **Ogni 30 secondi**: Backup automatico
- ✅ **Allo shutdown**: Salvataggio finale
- ✅ **Ad ogni aggiornamento**: Salvataggio immediato

### **3. 📱 Persistenza Client**

#### **localStorage Keys:**
- `clientRoom` - Nome stanza
- `clientRoomId` - ID univoco stanza
- `chat_${roomId}` - Messaggi della stanza

#### **Funzioni Client:**
```javascript
// Save message to localStorage
function saveMessageToLocalStorage(from, text, me, attachment, timestamp) {
  const roomId = localStorage.getItem('clientRoomId') || room;
  const key = `chat_${roomId}`;
  const existingMessages = JSON.parse(localStorage.getItem(key) || '[]');
  existingMessages.push(message);
  
  // Keep only last 100 messages
  if (existingMessages.length > 100) {
    existingMessages.splice(0, existingMessages.length - 100);
  }
  
  localStorage.setItem(key, JSON.stringify(existingMessages));
}

// Load messages from localStorage
function loadMessagesFromLocalStorage() {
  const roomId = localStorage.getItem('clientRoomId') || room;
  const key = `chat_${roomId}`;
  const messages = JSON.parse(localStorage.getItem(key) || '[]');
  
  // Load all messages to DOM
  messages.forEach(msg => {
    addMessageToDOM(msg.from, msg.text, msg.me, msg.attachment, msg.timestamp);
  });
}
```

### **4. 🔄 Riconnessione Automatica**

#### **Flusso di Riconnessione:**
1. **Client si connette** → Server crea/recupera stanza
2. **Server invia roomInfo** → Client salva ID stanza
3. **Client carica messaggi** → Da localStorage con ID stanza
4. **Riconnessione** → Usa ID salvato per recuperare chat

#### **Gestione ID Stanze:**
```javascript
// Server: Invia room info al client
ws.send(JSON.stringify({ 
  type: 'roomInfo', 
  roomId: roomData.get(room).id,
  roomName: room 
}));

// Client: Salva room info
if (data.type === 'roomInfo') {
  localStorage.setItem('clientRoomInfo', JSON.stringify(data));
  localStorage.setItem('clientRoomId', data.roomId);
}
```

## 🎯 **Risultati Ottenuti**

### **1. 👨‍💼 Admin Completo**
- ✅ **Vede tutti i messaggi** (client + admin)
- ✅ **Cronologia completa** quando si connette
- ✅ **Metadati stanze** con ID univoci
- ✅ **Persistenza** su server

### **2. 📱 Client Persistente**
- ✅ **Chat persistente** anche in background
- ✅ **Riconnessione automatica** con ID salvati
- ✅ **Messaggi salvati** in localStorage
- ✅ **Recupero automatico** alla riconnessione

### **3. 🏠 Sistema Stanze Robusto**
- ✅ **ID univoci** per ogni stanza
- ✅ **Persistenza** su server e client
- ✅ **Metadati completi** (creazione, attività)
- ✅ **Backup automatico** ogni 30 secondi

## 🔧 **File Modificati**

### **Server (`server.js`):**
- ✅ Aggiunto `roomData` Map per metadati stanze
- ✅ Funzioni `generateRoomId()`, `createRoom()`, `updateRoomActivity()`
- ✅ Persistenza su `./data/rooms-data.json`
- ✅ Invio `roomInfo` ai client
- ✅ Metadati stanze agli admin

### **Client (`index.html`):**
- ✅ Gestione `roomInfo` con salvataggio ID
- ✅ Funzioni `saveMessageToLocalStorage()`, `loadMessagesFromLocalStorage()`
- ✅ Persistenza messaggi con ID stanza
- ✅ Caricamento automatico alla connessione

## 🚨 **Note Importanti**

### **1. Persistenza:**
- **Server**: Salva su file JSON ogni 30 secondi
- **Client**: Salva su localStorage ad ogni messaggio
- **Limit**: 100 messaggi per stanza (evita overflow)

### **2. ID Stanze:**
- **Formato**: `room_${timestamp}_${random}`
- **Univoci**: Timestamp + random per evitare conflitti
- **Persistenti**: Salvati su server e client

### **3. Riconnessione:**
- **Automatica**: Client si riconnette con ID salvato
- **Chat**: Viene ricaricata da localStorage
- **Stanza**: Viene identificata tramite ID univoco

## 🎉 **Benefici**

1. **Chat Persistente**: I messaggi non si perdono mai
2. **Riconnessione Robusta**: Client si riconnette automaticamente
3. **ID Univoci**: Ogni stanza ha un identificativo unico
4. **Backup Automatico**: Dati salvati ogni 30 secondi
5. **Recupero Completo**: Chat ripristinata alla riconnessione

Ora l'app è molto più robusta e mantiene la chat anche quando il client va in background! 🚀

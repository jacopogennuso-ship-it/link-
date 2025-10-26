const express = require('express');
const ws = require('ws');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const webpush = require('web-push');
const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static('uploads'));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => {
  if(req.query.pass !== 'secret123') return res.status(403).send('Accesso negato');
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// File upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ 
    filename: req.file.filename, 
    originalName: req.file.originalname,
    url: `/uploads/${req.file.filename}` 
  });
});

// Push subscription endpoint
app.post('/subscribe-push', (req, res) => {
  try {
    const { subscription, room } = req.body;
    
    if (!subscription || !room) {
      return res.status(400).json({ error: 'Missing subscription or room' });
    }
    
    // Load existing subscriptions
    const subscriptions = loadPushSubscriptions();
    
    // Add new subscription
    subscriptions.set(room, subscription);
    
    // Save to file
    savePushSubscriptions(subscriptions);
    
    console.log(`📱 Push subscription saved for room: ${room}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Push subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// VAPID public key endpoint
app.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

const wss = new ws.Server({ noServer: true });
const clients = new Map(); // room -> ws
const admins = new Set();
const rooms = new Set(); // Track available rooms
const chatHistory = new Map(); // room -> messages array
const roomData = new Map(); // room -> { id, name, createdAt, lastActivity }
const CHAT_HISTORY_FILE = './data/chat-history.json';
const ROOMS_DATA_FILE = './data/rooms-data.json';
const PUSH_SUBSCRIPTIONS_FILE = './data/push-subscriptions.json';

// VAPID Keys (genera su https://vapidkeys.com/)
const VAPID_PUBLIC_KEY = 'BB8FYQIMEa7-25gltUu85BZY5plHQt962LWvr4EztI2oChOCzDA5rmdRl8HF3s7psoyynwRche6Fwue3AYuvfhU';
const VAPID_PRIVATE_KEY = 'IUuMBnSYPtSdKf1l-VrKHhxF2yfzw1IUGsQR5fh1P0c';

// Configure VAPID
webpush.setVapidDetails(
  'mailto:jacopo.gennuso@gmail.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Ensure data directory exists
if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data', { recursive: true });
}

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

function updateRoomActivity(roomId) {
  if (roomData.has(roomId)) {
    const data = roomData.get(roomId);
    data.lastActivity = new Date().toISOString();
    roomData.set(roomId, data);
    // Save rooms data when updated
    saveRoomsData();
  }
}

// Load chat history from file
function loadChatHistory() {
  try {
    if (fs.existsSync(CHAT_HISTORY_FILE)) {
      const data = fs.readFileSync(CHAT_HISTORY_FILE, 'utf8');
      const history = JSON.parse(data);
      for (const [room, messages] of Object.entries(history)) {
        chatHistory.set(room, messages);
      }
      console.log('Chat history loaded from file');
    }
  } catch (err) {
    console.error('Error loading chat history:', err);
  }
}

// Save chat history to file
function saveChatHistory() {
  try {
    const history = Object.fromEntries(chatHistory);
    fs.writeFileSync(CHAT_HISTORY_FILE, JSON.stringify(history, null, 2));
    console.log('Chat history saved to file');
  } catch (err) {
    console.error('Error saving chat history:', err);
  }
}

// Load rooms data from file
function loadRoomsData() {
  try {
    if (fs.existsSync(ROOMS_DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(ROOMS_DATA_FILE, 'utf8'));
      roomData.clear();
      Object.entries(data).forEach(([room, roomInfo]) => {
        roomData.set(room, roomInfo);
        rooms.add(room);
      });
      console.log('Rooms data loaded from file');
    }
  } catch (error) {
    console.error('Error loading rooms data:', error);
  }
}

// Save rooms data to file
function saveRoomsData() {
  try {
    const data = Object.fromEntries(roomData);
    fs.writeFileSync(ROOMS_DATA_FILE, JSON.stringify(data, null, 2));
    console.log('Rooms data saved to file');
  } catch (error) {
    console.error('Error saving rooms data:', error);
  }
}

// Load push subscriptions from file
function loadPushSubscriptions() {
  try {
    if (fs.existsSync(PUSH_SUBSCRIPTIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PUSH_SUBSCRIPTIONS_FILE, 'utf8'));
      return new Map(Object.entries(data));
    }
  } catch (error) {
    console.error('Error loading push subscriptions:', error);
  }
  return new Map();
}

// Save push subscriptions to file
function savePushSubscriptions(subscriptions) {
  try {
    const data = Object.fromEntries(subscriptions);
    fs.writeFileSync(PUSH_SUBSCRIPTIONS_FILE, JSON.stringify(data, null, 2));
    console.log('Push subscriptions saved to file');
  } catch (error) {
    console.error('Error saving push subscriptions:', error);
  }
}

// Send push notification
async function sendPushNotification(room, title, message) {
  try {
    const subscriptions = loadPushSubscriptions();
    const subscription = subscriptions.get(room);
    
    if (!subscription) {
      console.log(`❌ No push subscription found for room: ${room}`);
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
    console.log(`📤 Push notification sent to room ${room}: ${message}`);
  } catch (error) {
    console.error('Push notification error:', error);
  }
}

// Load data on startup
loadChatHistory();
loadRoomsData();

// Save data every 30 seconds as backup
setInterval(() => {
  if (chatHistory.size > 0) {
    saveChatHistory();
  }
  if (roomData.size > 0) {
    saveRoomsData();
  }
}, 30000);

const server = app.listen(PORT, ()=>console.log(`Server attivo su http://localhost:${PORT}`));

// Save data on server shutdown
process.on('SIGINT', () => {
  console.log('Saving data before shutdown...');
  saveChatHistory();
  saveRoomsData();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Saving data before shutdown...');
  saveChatHistory();
  saveRoomsData();
  process.exit(0);
});

server.on('upgrade', (req, socket, head)=>{
  wss.handleUpgrade(req, socket, head, ws=>wss.emit('connection', ws, req));
});

wss.on('connection', (ws, req)=>{
  const url = new URL(req.url, `http://${req.headers.host}`);
  const role = url.searchParams.get('role');
  const room = url.searchParams.get('room') || null;

  ws.role = role;
  ws.room = room;

  if(role==='client' && room) {
    // Check if room exists, create if not
    if (!roomData.has(room)) {
      const { roomId, roomData: newRoomData } = createRoom(room);
      roomData.set(room, newRoomData);
    }
    
    clients.set(room, ws);
    rooms.add(room);
    updateRoomActivity(room);
    
    console.log(`📱 Client connected to room: ${room}`);
    console.log(`📊 Total rooms: ${rooms.size}, Total clients: ${clients.size}`);
    
    // Send room ID to client
    ws.send(JSON.stringify({ 
      type: 'roomInfo', 
      roomId: roomData.get(room).id,
      roomName: room 
    }));
    
    // Notify admins about new client
    admins.forEach(a=>{
      if(a.readyState===ws.OPEN) {
        a.send(JSON.stringify({ 
          type:'clientConnected', 
          room,
          roomId: roomData.get(room).id 
        }));
        console.log(`📤 Notified admin about client connection: ${room}`);
      }
    });
  }
  if(role==='admin') {
    admins.add(ws);
    console.log(`👨‍💼 Admin connected. Total admins: ${admins.size}`);
    console.log(`📊 Available rooms: ${Array.from(rooms)}`);
    
    // Send list of available rooms with metadata to new admin
    const roomsList = Array.from(rooms).map(room => {
      const data = roomData.get(room);
      return {
        room,
        roomId: data ? data.id : null,
        name: data ? data.name : room,
        createdAt: data ? data.createdAt : null,
        lastActivity: data ? data.lastActivity : null
      };
    });
    
    ws.send(JSON.stringify({ 
      type:'roomsList', 
      rooms: roomsList 
    }));
    console.log(`📤 Sent rooms list to admin: ${roomsList.length} rooms`);
  }

  ws.on('message', msg=>{
    try{
      const data = JSON.parse(msg);

      // Chat with attachments
      if(data.type==='chat'){
        const message = {
          from: ws.role==='client' ? room : 'Admin',
          text: data.text,
          attachment: data.attachment,
          timestamp: new Date().toISOString()
        };
        
        // Save message to history
        if (!chatHistory.has(room)) {
          chatHistory.set(room, []);
        }
        chatHistory.get(room).push(message);
        
        console.log(`Message saved for room ${room}:`, message);
        console.log(`Total messages in room ${room}:`, chatHistory.get(room).length);
        
        // Save to file after adding message
        saveChatHistory();
        
        if(ws.role==='client'){
          // Send client message to all admins
          admins.forEach(a=>{
            if(a.readyState===ws.OPEN) a.send(JSON.stringify({ 
              type:'chat', 
              ...message
            }));
          });
        } else if(ws.role==='admin'){
          // Admin can send to specific room or broadcast to all
          const targetRoom = data.room || ws.selectedRoom;
          if(targetRoom && clients.has(targetRoom)){
            const c=clients.get(targetRoom);
            if(c.readyState===ws.OPEN) {
              c.send(JSON.stringify({ 
                type:'chat', 
                ...message
              }));
              
              // Send push notification to client
              c.send(JSON.stringify({
                type: 'pushNotification',
                title: 'Nuovo messaggio da Admin',
                body: message.text,
                icon: '/icons/icon-192x192.svg',
                badge: '/icons/icon-72x72.svg'
              }));
              
              // Also send a visual notification for in-app display
              c.send(JSON.stringify({
                type: 'visualNotification',
                title: 'Nuovo messaggio da Admin',
                body: message.text,
                timestamp: Date.now()
              }));
              
              // Send real push notification (external)
              sendPushNotification(targetRoom, 'Nuovo messaggio da Admin', message.text);
              
              console.log(`📤 Push notification sent to room ${targetRoom}: ${message.text}`);
            }
          }
          
          // Send admin message back to admin for display
          ws.send(JSON.stringify({ 
            type:'chat', 
            ...message
          }));
        }
      }

      // Video with improved streaming
      if(data.type==='video'){
        admins.forEach(a=>{
          if(a.readyState===ws.OPEN) a.send(JSON.stringify({ 
            type:'video', 
            room:room, 
            cam:data.cam, 
            image:data.image,
            timestamp: Date.now()
          }));
        });
      }

      // Audio streaming
      if(data.type==='audio'){
        admins.forEach(a=>{
          if(a.readyState===ws.OPEN) a.send(JSON.stringify({ 
            type:'audio', 
            room:room, 
            audio:data.audio,
            sampleRate: data.sampleRate,
            timestamp: Date.now()
          }));
        });
      }

      // Camera control from admin
      if(data.type==='cameraControl'){
        if(ws.role==='admin'){
          const targetRoom = data.targetRoom || data.room;
          console.log(`🎥 Camera control request for room: ${targetRoom}`);
          console.log(`📊 Available clients: ${Array.from(clients.keys())}`);
          
          if(targetRoom && clients.has(targetRoom)){
            const client = clients.get(targetRoom);
            if(client.readyState===ws.OPEN) {
              client.send(JSON.stringify({ 
                type:'cameraControl', 
                camera: data.camera,
                quality: data.quality || 'medium'
              }));
              console.log(`✅ Camera control sent to room ${targetRoom}: ${data.camera}`);
            } else {
              console.log(`❌ Client in room ${targetRoom} is not open`);
            }
          } else {
            console.log(`❌ Room ${targetRoom} not found in clients`);
          }
        }
      }

      // Room selection
      if(data.type==='selectRoom'){
        if(ws.role==='admin'){
          ws.selectedRoom = data.room;
          ws.send(JSON.stringify({ type:'roomSelected', room: data.room }));
          console.log(`📋 Admin selected room: ${data.room}`);
          
          // Send chat history for the selected room
          if(chatHistory.has(data.room)){
            const history = chatHistory.get(data.room);
            console.log(`📚 Sending chat history for room ${data.room}: ${history.length} messages`);
            ws.send(JSON.stringify({ 
              type:'chatHistory', 
              room: data.room,
              messages: history 
            }));
          } else {
            console.log(`📚 No chat history found for room ${data.room}`);
          }
        }
      }

      // Heartbeat ping for PWA connection stability
      if(data.type==='ping'){
        console.log(`💓 Heartbeat received from ${ws.role} ${room || 'admin'}`);
        ws.send(JSON.stringify({ type:'pong', timestamp: data.timestamp }));
      }

    }catch(err){ console.error(err); }
  });

  ws.on('close', ()=>{
    console.log(`❌ WebSocket disconnected: ${ws.role} ${room || 'admin'}`);
    
    if(ws.role==='client' && room){
      clients.delete(room);
      rooms.delete(room);
      console.log(`📱 Client disconnected from room: ${room}`);
      console.log(`📊 Remaining rooms: ${rooms.size}, Remaining clients: ${clients.size}`);
      
      // Notify admins about client disconnection
      admins.forEach(a=>{
        if(a.readyState===ws.OPEN) {
          a.send(JSON.stringify({ type:'clientDisconnected', room }));
          console.log(`📤 Notified admin about client disconnection: ${room}`);
        }
      });
    }
    if(ws.role==='admin') {
      admins.delete(ws);
      console.log(`👨‍💼 Admin disconnected. Remaining admins: ${admins.size}`);
    }
  });
});

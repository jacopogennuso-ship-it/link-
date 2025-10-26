const express = require('express');
const ws = require('ws');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
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

const wss = new ws.Server({ noServer: true });
const clients = new Map(); // room -> ws
const admins = new Set();
const rooms = new Set(); // Track available rooms

const server = app.listen(PORT, ()=>console.log(`Server attivo su http://localhost:${PORT}`));

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
    clients.set(room, ws);
    rooms.add(room);
    // Notify admins about new client
    admins.forEach(a=>{
      if(a.readyState===ws.OPEN) a.send(JSON.stringify({ type:'clientConnected', room }));
    });
  }
  if(role==='admin') {
    admins.add(ws);
    // Send list of available rooms to new admin
    ws.send(JSON.stringify({ type:'roomsList', rooms: Array.from(rooms) }));
  }

  ws.on('message', msg=>{
    try{
      const data = JSON.parse(msg);

      // Chat with attachments
      if(data.type==='chat'){
        if(ws.role==='client'){
          admins.forEach(a=>{
            if(a.readyState===ws.OPEN) a.send(JSON.stringify({ 
              type:'chat', 
              from:room, 
              text:data.text, 
              attachment: data.attachment,
              timestamp: new Date().toISOString()
            }));
          });
        } else if(ws.role==='admin'){
          // Admin can send to specific room or broadcast to all
          const targetRoom = data.room || ws.selectedRoom;
          if(targetRoom && clients.has(targetRoom)){
            const c=clients.get(targetRoom);
            if(c.readyState===ws.OPEN) c.send(JSON.stringify({ 
              type:'chat', 
              from:'Admin', 
              text:data.text,
              attachment: data.attachment,
              timestamp: new Date().toISOString()
            }));
          }
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

      // Camera control from admin
      if(data.type==='cameraControl'){
        if(ws.role==='admin'){
          const targetRoom = data.targetRoom || ws.selectedRoom;
          if(targetRoom && clients.has(targetRoom)){
            const client = clients.get(targetRoom);
            if(client.readyState===ws.OPEN) {
              client.send(JSON.stringify({ 
                type:'cameraControl', 
                camera: data.camera,
                quality: data.quality || 'medium'
              }));
              console.log(`Camera control sent to room ${targetRoom}: ${data.camera}`);
            }
          }
        }
      }

      // Room selection
      if(data.type==='selectRoom'){
        if(ws.role==='admin'){
          ws.selectedRoom = data.room;
          ws.send(JSON.stringify({ type:'roomSelected', room: data.room }));
        }
      }

    }catch(err){ console.error(err); }
  });

  ws.on('close', ()=>{
    if(ws.role==='client' && room){
      clients.delete(room);
      rooms.delete(room);
      admins.forEach(a=>{
        if(a.readyState===ws.OPEN) a.send(JSON.stringify({ type:'clientDisconnected', room }));
      });
    }
    if(ws.role==='admin') admins.delete(ws);
  });
});

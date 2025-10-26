const express = require('express');
const ws = require('ws');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve file statici (index.html, admin.html)
app.use(express.static(path.join(__dirname)));

// ROUTE CLIENT
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ROUTE ADMIN
app.get('/admin', (req, res) => {
  if (req.query.pass !== 'secret123') return res.status(403).send('Accesso negato');
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// WebSocket Server
const wss = new ws.Server({ noServer: true });

// Map per gestire i client
const clients = new Map(); // room -> ws
const admins = new Set(); // ws

// Upgrade HTTP -> WS
const server = app.listen(PORT, () => console.log(`Server attivo su http://localhost:${PORT}`));
server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const role = url.searchParams.get('role');
  const room = url.searchParams.get('room') || null;

  ws.role = role;
  ws.room = room;

  if (role === 'client' && room) {
    clients.set(room, ws);
    console.log(`Client connesso: ${room}`);
  }

  if (role === 'admin') {
    admins.add(ws);
    console.log('Admin connesso');
  }

  ws.on('message', message => {
    // Tutti i messaggi devono essere JSON
    try {
      const data = JSON.parse(message);

      if (data.type === 'chat') {
        // Invia messaggio a tutti admin e al client specifico
        if (ws.role === 'client') {
          admins.forEach(a => a.readyState === ws.OPEN && a.send(JSON.stringify({ ...data, from:`${room}` })));
        } else if (ws.role === 'admin') {
          if (room && clients.has(room)) {
            const clientWs = clients.get(room);
            clientWs.readyState === ws.OPEN && clientWs.send(JSON.stringify({ ...data, from:'Admin' }));
          }
        }
      }

      if (data.type === 'cameraStatus') {
        // Status fotocamera: accettata o rifiutata
        admins.forEach(a => a.readyState === ws.OPEN && a.send(JSON.stringify({ type:'cameraStatus', room:data.room, status:data.status })));
      }

      if (data.type === 'video') {
        // data.image: dataURL JPEG
        // data.cam: 'back' o 'front'
        admins.forEach(a => {
          if(a.readyState === ws.OPEN) a.send(JSON.stringify({ type:'video', cam:data.cam, room:data.room, image:data.image }));
        });
      }

    } catch(err) {
      console.error('Messaggio WS non valido', err);
    }
  });

  ws.on('close', () => {
    if (ws.role === 'client' && room) {
      clients.delete(room);
      admins.forEach(a => {
        if(a.readyState === ws.OPEN) a.send(JSON.stringify({ type:'clientDisconnected', room }));
      });
      console.log(`Client disconnesso: ${room}`);
    }
    if(ws.role === 'admin') admins.delete(ws);
  });
});

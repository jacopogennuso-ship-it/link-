// server.js
const express = require('express');
const path = require('path');
const ws = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => {
  if (req.query.pass !== 'secret123') return res.status(403).send('Accesso negato');
  res.sendFile(path.join(__dirname, 'admin.html'));
});

const server = app.listen(PORT, () => {
  console.log(`Server avviato su http://localhost:${PORT}`);
});

// WebSocket server (single endpoint /ws)
const wss = new ws.Server({ noServer: true });

// Keep track of clients and admins
const clients = new Map(); // room -> socket
const admins = new Set();

server.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  if (pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (wsSocket) => {
      wss.emit('connection', wsSocket, req);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (socket, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const role = url.searchParams.get('role') || 'client';
  const room = url.searchParams.get('room') || `user-${Math.random().toString(36).slice(2,8)}`;

  console.log(`Connessione: role=${role}, room=${room}`);

  if (role === 'admin') {
    admins.add(socket);
    // send current clients list
    const list = Array.from(clients.keys());
    socket.send(JSON.stringify({ type: 'clientsList', clients: list }));
  } else {
    clients.set(room, socket);
    // notify admins of new client
    const msg = JSON.stringify({ type: 'clientConnected', room });
    admins.forEach(a => { if (a.readyState === ws.OPEN) a.send(msg); });
  }

  // Handle messages
  socket.on('message', (raw) => {
    // Messages are JSON strings (except -- we won't accept binary here)
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.warn('Invalid message', raw);
      return;
    }

    // Chat messages (bidirectional)
    if (data.type === 'chat') {
      // data: { type:'chat', from:'Utente'|'Admin', text:'...', room: 'room' }
      if (data.from === 'Admin') {
        // forward to client
        const target = clients.get(data.room);
        if (target && target.readyState === ws.OPEN) target.send(JSON.stringify(data));
      } else {
        // from client -> forward to all admins
        admins.forEach(a => { if (a.readyState === ws.OPEN) a.send(JSON.stringify(data)); });
      }
    }

    // Video frames from client => forward to all admins
    else if (data.type === 'video') {
      // data: { type:'video', room:'room', image:'data:image/jpeg;base64,...' }
      admins.forEach(a => {
        if (a.readyState === ws.OPEN) {
          a.send(JSON.stringify({ type: 'video', room: data.room, image: data.image }));
        }
      });
    }

    // Camera consent / status messages
    else if (data.type === 'cameraStatus') {
      // data: { type:'cameraStatus', room:'room', status: 'accepted'|'declined'|'stopped' }
      admins.forEach(a => { if (a.readyState === ws.OPEN) a.send(JSON.stringify(data)); });
    }

    // Admin requests list of clients
    else if (data.type === 'listClients') {
      const list = Array.from(clients.keys());
      socket.send(JSON.stringify({ type: 'clientsList', clients: list }));
    }

    // Admin can request to ask client to start/stop camera (this is optional)
    else if (data.type === 'requestCamera') {
      // data: { type:'requestCamera', room:'room', action:'ask' } -> forwarded to client as an informational request
      const target = clients.get(data.room);
      if (target && target.readyState === ws.OPEN) target.send(JSON.stringify({ type: 'requestCamera', action: data.action }));
    }

    // any other message types can be added as needed
  });

  socket.on('close', () => {
    if (role === 'admin') {
      admins.delete(socket);
    } else {
      clients.delete(room);
      // notify admins
      const msg = JSON.stringify({ type: 'clientDisconnected', room });
      admins.forEach(a => { if (a.readyState === ws.OPEN) a.send(msg); });
    }
    console.log(`Disconnessione: role=${role}, room=${room}`);
  });

  socket.on('error', (err) => {
    console.error('WS error', err && err.message);
  });
});

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

// WebSocket endpoint: /ws
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

function broadcastAdmins(obj) {
  const raw = JSON.stringify(obj);
  admins.forEach(a => {
    if (a.readyState === ws.OPEN) a.send(raw);
  });
}

wss.on('connection', (socket, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const role = url.searchParams.get('role') || 'client';
  const room = url.searchParams.get('room') || `user-${Math.random().toString(36).slice(2,8)}`;

  console.log(`Connessione: role=${role}, room=${room}`);

  if (role === 'admin') {
    admins.add(socket);
    // send full clients list + their last known cameraStatus (we only store rooms; status is ephemeral)
    socket.send(JSON.stringify({ type: 'clientsList', clients: Array.from(clients.keys()) }));
  } else {
    clients.set(room, socket);
    // notify admins a client connected
    broadcastAdmins({ type: 'clientConnected', room });
  }

  socket.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.warn('Non-JSON message ignored');
      return;
    }

    // Chat messages (text)
    if (data.type === 'chat') {
      // if from admin -> forward to client
      if (data.from === 'Admin') {
        const target = clients.get(data.room);
        if (target && target.readyState === ws.OPEN) target.send(JSON.stringify(data));
      } else {
        // from client -> forward to all admins
        broadcastAdmins(data);
      }
      return;
    }

    // Video frame from client -> forward to admins
    if (data.type === 'video' && data.room && data.image) {
      broadcastAdmins({ type: 'video', room: data.room, image: data.image });
      return;
    }

    // Camera status (accepted/declined/stopped) from client -> notify admins
    if (data.type === 'cameraStatus' && data.room && data.status) {
      broadcastAdmins({ type: 'cameraStatus', room: data.room, status: data.status });
      return;
    }

    // Admin requests list of clients
    if (data.type === 'listClients') {
      socket.send(JSON.stringify({ type: 'clientsList', clients: Array.from(clients.keys()) }));
      return;
    }

    // Admin requests client to show consent modal (optional)
    if (data.type === 'requestCamera' && data.room) {
      const target = clients.get(data.room);
      if (target && target.readyState === ws.OPEN) {
        target.send(JSON.stringify({ type: 'requestCamera', action: data.action || 'ask' }));
      }
      return;
    }
  });

  socket.on('close', () => {
    if (role === 'admin') {
      admins.delete(socket);
    } else {
      clients.delete(room);
      broadcastAdmins({ type: 'clientDisconnected', room });
    }
    console.log(`Disconnessione: role=${role}, room=${room}`);
  });

  socket.on('error', (err) => {
    console.error('WS error:', err && err.message);
  });
});



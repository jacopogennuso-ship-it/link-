// ======== server.js ========
const express = require('express');
const path = require('path');
const fs = require('fs');
const ws = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve le pagine statiche
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => {
  if (req.query.pass !== 'secret123') {
    return res.status(403).send('Accesso negato');
  }
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Avvia server HTTP
const server = app.listen(PORT, () => {
  console.log(`✅ Server avviato su http://localhost:${PORT}`);
});

// ======== WEBSOCKET SERVER ========
const wss = new ws.Server({ noServer: true });

// Mappa utenti e admin
const clients = new Map(); // room → socket
const admins = new Set();  // admin sockets

// Upgrade HTTP → WS
server.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  if (pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

// Connessione WebSocket
wss.on('connection', (socket, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const role = url.searchParams.get('role');  // "admin" o "client"
  const room = url.searchParams.get('room') || 'default';

  console.log(`🔗 Nuova connessione ${role} (${room})`);

  if (role === 'admin') {
    admins.add(socket);
  } else {
    clients.set(room, socket);
  }

  // Gestione messaggi
  socket.on('message', (rawData) => {
    let msg;
    try {
      msg = JSON.parse(rawData);
    } catch (err) {
      console.error('Messaggio non valido:', rawData);
      return;
    }

    // === CHAT ===
    if (msg.type === 'chat') {
      if (role === 'admin') {
        const client = clients.get(msg.room);
        if (client && client.readyState === ws.OPEN) {
          client.send(JSON.stringify(msg));
        }
      } else {
        // Invia messaggio a tutti gli admin connessi
        admins.forEach(a => {
          if (a.readyState === ws.OPEN) a.send(JSON.stringify(msg));
        });
      }
    }

    // === VIDEO ===
    else if (msg.type === 'video' && msg.image) {
      admins.forEach(a => {
        if (a.readyState === ws.OPEN) {
          a.send(JSON.stringify({
            type: 'video',
            room,
            image: msg.image
          }));
        }
      });
    }
  });

  // Gestione chiusura connessione
  socket.on('close', () => {
    console.log(`❌ Disconnessione ${role} (${room})`);
    if (role === 'admin') {
      admins.delete(socket);
    } else {
      clients.delete(room);
    }
  });

  socket.on('error', (err) => {
    console.error('Errore WS:', err.message);
  });
});

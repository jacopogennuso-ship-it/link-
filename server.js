const express = require('express');
const ws = require('ws');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// === SERVE CLIENT (index.html) ===
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// === SERVE ADMIN CON PASSWORD ===
app.get('/admin', (req, res) => {
  if (req.query.pass !== 'secret123') {
    return res.status(403).send('Accesso negato');
  }
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// === CREA ADMIN.HTML DINAMICAMENTE SE NON ESISTE ===
if (!fs.existsSync(path.join(__dirname, 'admin.html'))) {
  fs.writeFileSync(path.join(__dirname, 'admin.html'), '<!-- admin.html verrà aggiornato automaticamente -->');
}

// === WEBSOCKET SERVERS ===
const bgWss = new ws.Server({ noServer: true });     // utenti che inviano video
const adminWss = new ws.Server({ noServer: true });  // dashboard admin

const clients = new Map(); // room → ws

// === HANDLER STREAM IN INGRESSO (da utenti) ===
bgWss.on('connection', (socket, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const room = url.searchParams.get('room') || 'unknown';

  console.log(`📷 Nuova camera connessa: ${room}`);
  clients.set(room, socket);

  socket.on('message', (data) => {
    if (typeof data === 'string' && data === 'ping') return;

    // Invia metadati e frame a tutti gli admin collegati
    const metadata = JSON.stringify({ room, timestamp: Date.now() });
    for (const client of adminWss.clients) {
      if (client.readyState === ws.OPEN) {
        try {
          client.send(metadata);
          if (data instanceof Buffer) client.send(data, { binary: true });
        } catch (err) {
          console.error('Errore invio frame:', err);
        }
      }
    }
  });

  socket.on('close', () => {
    clients.delete(room);
    console.log(`❌ Camera disconnessa: ${room}`);
    for (const admin of adminWss.clients) {
      if (admin.readyState === ws.OPEN) {
        admin.send(JSON.stringify({ room, offline: true }));
      }
    }
  });
});

// === ADMIN HANDLER ===
adminWss.on('connection', (socket) => {
  console.log('🖥️ Admin collegato');
  socket.send(JSON.stringify({ type: 'welcome' }));
});

// === SERVER HTTP + UPGRADE ===
const server = app.listen(PORT, () => {
  console.log(`🚀 Server attivo su: http://localhost:${PORT}`);
});

server.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;

  if (pathname === '/bg-stream') {
    bgWss.handleUpgrade(req, socket, head, (wsSocket) => {
      bgWss.emit('connection', wsSocket, req);
    });
  } else if (pathname === '/bg-admin') {
    adminWss.handleUpgrade(req, socket, head, (wsSocket) => {
      adminWss.emit('connection', wsSocket, req);
    });
  } else {
    socket.destroy();
  }
});

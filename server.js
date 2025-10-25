const express = require('express');
const ws = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// === PAGINA CLIENT ===
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// === PAGINA ADMIN PROTETTA ===
app.get('/admin', (req, res) => {
  if (req.query.pass !== 'secret123') {
    return res.status(403).send('Accesso negato');
  }
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// === CREAZIONE FILE ADMIN SE NON ESISTE ===
if (!fs.existsSync(path.join(__dirname, 'admin.html'))) {
  fs.writeFileSync(path.join(__dirname, 'admin.html'), '<!-- generato automaticamente -->');
}

// === WEBSOCKETS ===
const bgWss = new ws.Server({ noServer: true });     // per i client (camere)
const adminWss = new ws.Server({ noServer: true });  // per la dashboard

const clients = new Map(); // room → ws

// === CLIENT CAMERA (bg-stream) ===
bgWss.on('connection', (socket, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const room = url.searchParams.get('room') || 'unknown';

  console.log(`📷 Camera connessa: ${room}`);
  clients.set(room, socket);

  socket.on('message', (data) => {
    if (typeof data === 'string' && data === 'ping') return;

    const metadata = JSON.stringify({ room, timestamp: Date.now() });

    // Invia a tutti gli admin collegati
    for (const admin of adminWss.clients) {
      if (admin.readyState === ws.OPEN) {
        try {
          admin.send(metadata);
          if (data instanceof Buffer) admin.send(data, { binary: true });
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

// === ADMIN (bg-admin) ===
adminWss.on('connection', (socket) => {
  console.log('🖥️ Admin collegato');
  socket.send(JSON.stringify({ type: 'welcome' }));
});

// === AVVIO SERVER ===
const server = app.listen(PORT, () => {
  console.log(`🚀 Server attivo su: http://localhost:${PORT}`);
});

// === GESTIONE UPGRADE WEBSOCKET ===
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

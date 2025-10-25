const express = require('express');
const ws = require('ws');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve client
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Admin protetto
app.get('/admin', (req, res) => {
  if (req.query.pass !== 'secret123') return res.status(403).send('Accesso negato');
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// WebSocket servers
const bgWss = new ws.Server({ noServer: true });     // camere
const adminWss = new ws.Server({ noServer: true });  // dashboard

const clients = new Map(); // room → ws

// Client camere
bgWss.on('connection', (socket, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const room = url.searchParams.get('room') || 'unknown';
  console.log(`📷 Camera connessa: ${room}`);
  clients.set(room, socket);

  socket.on('message', (data) => {
    if (typeof data === 'string' && data === 'ping') return;
    const metadata = JSON.stringify({ room, timestamp: Date.now() });

    // Invia a tutti gli admin
    for (const admin of adminWss.clients) {
      if (admin.readyState === ws.OPEN) {
        try {
          admin.send(metadata);
          if (data instanceof Buffer) admin.send(data, { binary: true });
        } catch (err) { console.error('Errore invio frame:', err); }
      }
    }
  });

  socket.on('close', () => {
    clients.delete(room);
    console.log(`❌ Camera disconnessa: ${room}`);
    for (const admin of adminWss.clients) {
      if (admin.readyState === ws.OPEN) admin.send(JSON.stringify({ room, offline: true }));
    }
  });
});

// Admin dashboard
adminWss.on('connection', (socket) => {
  console.log('🖥️ Admin collegato');
  socket.send(JSON.stringify({ type: 'welcome' }));
});

// Avvio server
const server = app.listen(PORT, () => console.log(`🚀 Server attivo su http://localhost:${PORT}`));

// Gestione upgrade WebSocket
server.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  if (pathname === '/bg-stream') bgWss.handleUpgrade(req, socket, head, ws => bgWss.emit('connection', ws, req));
  else if (pathname === '/bg-admin') adminWss.handleUpgrade(req, socket, head, ws => adminWss.emit('connection', ws, req));
  else socket.destroy();
});

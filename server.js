const express = require('express');
const ws = require('ws');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => {
  if (req.query.pass !== 'secret123') return res.status(403).send('Accesso negato');
  res.sendFile(path.join(__dirname, 'admin.html'));
});

const bgWss = new ws.Server({ noServer: true });     // client camere
const adminWss = new ws.Server({ noServer: true });  // dashboard

const clients = new Map(); // room → ws

bgWss.on('connection', (socket, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const room = url.searchParams.get('room') || 'unknown';
  const camera = url.searchParams.get('camera') || 'environment'; // front/user
  console.log(`📷 Camera connessa: ${room} (${camera})`);
  clients.set(`${room}-${camera}`, socket);

  socket.on('message', (data) => {
    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'switchCamera') {
          // Invia comando al client principale
          const mainClient = clients.get(`${room}-current`);
          if (mainClient && mainClient.readyState === ws.OPEN) {
            mainClient.send(JSON.stringify({ type: 'switchCamera', camera: msg.camera }));
          }
          return;
        }
        if (data === 'ping') return;
      } catch {}
    }

    // Invia a tutti gli admin
    for (const admin of adminWss.clients) {
      if (admin.readyState === ws.OPEN) {
        try {
          if (!(data instanceof Buffer)) continue;
          admin.send(JSON.stringify({ room, camera, timestamp: Date.now() }));
          admin.send(data, { binary: true });
        } catch (err) { console.error('Errore invio frame:', err); }
      }
    }
  });

  socket.on('close', () => {
    clients.delete(`${room}-${camera}`);
    for (const admin of adminWss.clients) {
      if (admin.readyState === ws.OPEN) admin.send(JSON.stringify({ room, camera, offline: true }));
    }
  });
});

// Admin dashboard
adminWss.on('connection', (socket) => {
  console.log('🖥️ Admin collegato');
  socket.send(JSON.stringify({ type: 'welcome' }));
});

const server = app.listen(PORT, () => console.log(`🚀 Server attivo su http://localhost:${PORT}`));

server.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  if (pathname === '/bg-stream') bgWss.handleUpgrade(req, socket, head, ws => bgWss.emit('connection', ws, req));
  else if (pathname === '/bg-admin') adminWss.handleUpgrade(req, socket, head, ws => adminWss.emit('connection', ws, req));
  else socket.destroy();
});

const express = require('express');
const ws = require('ws');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Servi le pagine
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => {
  if (req.query.pass !== 'secret123') return res.status(403).send('Accesso negato');
  res.sendFile(path.join(__dirname, 'admin.html'));
});

const server = app.listen(PORT, () => console.log(`✅ Server attivo su http://localhost:${PORT}`));

// === WEBSOCKET ===
const wss = new ws.Server({ noServer: true });

// Mappa client/admin
const clients = new Map(); // room → ws
const admins = new Set();

// Gestione WebSocket
server.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  if (pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  } else socket.destroy();
});

wss.on('connection', (socket, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const role = url.searchParams.get('role');
  const room = url.searchParams.get('room') || 'default';

  if (role === 'admin') admins.add(socket);
  else clients.set(room, socket);

  socket.on('message', (data) => {
    try {
      const msg = JSON.parse(data);

      // CHAT: invia messaggio a client/admin
      if (msg.type === 'chat') {
        if (role === 'admin') {
          const client = clients.get(msg.room);
          if (client && client.readyState === ws.OPEN) client.send(data);
        } else {
          admins.forEach(a => a.send(data));
        }
      }

      // VIDEO: inoltra i frame all'admin
      else if (msg.type === 'video') {
        admins.forEach(a => {
          if (a.readyState === ws.OPEN) a.send(JSON.stringify({
            type: 'video',
            room,
            image: msg.image
          }));
        });
      }
    } catch

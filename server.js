const express = require('express');
const path = require('path');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => {
  if (req.query.pass !== 'secret123') return res.status(403).send('Accesso negato');
  res.sendFile(path.join(__dirname, 'admin.html'));
});

const server = app.listen(PORT, () => console.log(`🚀 Server attivo su http://localhost:${PORT}`));

const wss = new WebSocketServer({ noServer: true });
const rooms = new Map(); // room -> {client: ws, admins: Set<ws>}

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/signal') {
    wss.handleUpgrade(req, socket, head, ws => {
      ws.on('message', msg => handleMessage(ws, msg));
      ws.on('close', () => handleClose(ws));
    });
  } else socket.destroy();
});

function handleMessage(ws, msg) {
  let data;
  try { data = JSON.parse(msg); } catch { return; }

  if (data.type === 'register') {
    ws.role = data.role;
    ws.room = data.room || 'default';
    if (!rooms.has(ws.room)) rooms.set(ws.room, { client: null, admins: new Set() });
    const r = rooms.get(ws.room);
    if (ws.role === 'client') r.client = ws;
    else r.admins.add(ws);
  } else if (data.type === 'offer' || data.type === 'answer' || data.type === 'ice') {
    const r = rooms.get(ws.room);
    if (!r) return;
    if (ws.role === 'client') {
      r.admins.forEach(admin => { if (admin.readyState === 1) admin.send(msg); });
    } else {
      if (r.client && r.client.readyState === 1) r.client.send(msg);
    }
  } else if (data.type === 'switchCamera') {
    const r = rooms.get(ws.room);
    if (r?.client && r.client.readyState === 1) r.client.send(JSON.stringify({ type: 'switchCamera', camera: data.camera }));
  }
}

function handleClose(ws) {
  const r = rooms.get(ws.room);
  if (!r) return;
  if (ws.role === 'client') r.client = null;
  else r.admins.delete(ws);
}



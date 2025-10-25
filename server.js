const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// middleware
app.use(express.json());

// serve files
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => {
  if (req.query.pass !== 'secret123') return res.status(403).send('Accesso negato');
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// room -> preferred camera mode (not mandatory but kept for API)
const cameraPreferences = new Map();

// clients map: room -> ws (the background client streaming frames)
const clients = new Map();

// HTTP server + WebSocket servers (paths separate)
const server = http.createServer(app);
const bgWss = new WebSocket.Server({ server, path: '/bg-stream' });
const adminWss = new WebSocket.Server({ server, path: '/bg-admin' });

// API to switch camera for a room
app.post('/api/switch-camera', (req, res) => {
  const room = req.query.room;
  if (!room) return res.status(400).json({ error: 'room query required' });

  const current = cameraPreferences.get(room) || 'environment';
  const next = current === 'environment' ? 'user' : 'environment';
  cameraPreferences.set(room, next);

  const client = clients.get(room);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify({ type: 'switch-camera', mode: next }), (err) => {
      if (err) return res.status(500).json({ error: 'failed to notify client' });
      return res.json({ success: true, mode: next });
    });
  } else {
    return res.json({ success: false, error: 'client-not-connected' });
  }
});

// Handle background client connections (devices streaming frames)
bgWss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const room = url.searchParams.get('room') || 'unknown';
  clients.set(room, ws);

  ws.on('message', async (data) => {
    // a 'ping' string is ignored
    if (typeof data === 'string') {
      try {
        const txt = data.toString();
        if (txt === 'ping') return;
      } catch {}
    }

    // forward to all admin clients: first a JSON control message, then the binary frame
    for (const client of adminWss.clients) {
      if (client.readyState !== WebSocket.OPEN) continue;
      try {
        client.send(JSON.stringify({ room, timestamp: Date.now() }));
        // small delay is unnecessary but keeps ordering when network is fast
        if (Buffer.isBuffer(data)) {
          client.send(data, { binary: true });
        }
      } catch (err) {
        console.error('forward error', err);
      }
    }
  });

  ws.on('close', () => {
    clients.delete(room);
    // notify admins that room went offline
    for (const client of adminWss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ room, offline: true }));
      }
    }
  });
});

// Admin connections
adminWss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'welcome' }));
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});


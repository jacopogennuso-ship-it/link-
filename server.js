const express = require('express');
const path = require('path');
const ws = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

// Route per client e admin
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => {
  if (req.query.pass !== 'secret123') {
    return res.status(403).send('Accesso negato');
  }
  res.sendFile(path.join(__dirname, 'admin.html'));
});

const server = app.listen(PORT, () => {
  console.log(`✅ Server attivo su http://localhost:${PORT}`);
});

const wss = new ws.Server({ noServer: true });
const clients = new Map();
const admins = new Set();

server.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  if (pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

wss.on('connection', (socket, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const role = url.searchParams.get('role');
  const room = url.searchParams.get('room') || 'default';

  if (role === 'admin') admins.add(socket);
  else clients.set(room, socket);

  socket.on('message', data => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    // Chat messages
    if (msg.type === 'chat') {
      if (role === 'admin') {
        const client = clients.get(msg.room);
        if (client && client.readyState === ws.OPEN) client.send(JSON.stringify(msg));
      } else {
        admins.forEach(a => {
          if (a.readyState === ws.OPEN) a.send(JSON.stringify(msg));
        });
      }
    }

    // Video frames
    if (msg.type === 'video') {
      admins.forEach(a => {
        if (a.readyState === ws.OPEN)
          a.send(JSON.stringify({ type: 'video', room, image: msg.image }));
      });
    }

    // Admin richiede cambio fotocamera
    if (msg.type === 'switch_camera' && role === 'admin') {
      const client = clients.get(msg.room);
      if (client && client.readyState === ws.OPEN)
        client.send(JSON.stringify({ type: 'switch_camera', camera: msg.camera }));
    }
  });

  socket.on('close', () => {
    if (role === 'admin') admins.delete(socket);
    else clients.delete(room);
  });
});

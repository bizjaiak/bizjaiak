import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const socket = io();

export default function App() {
  const [name,setName] = useState('');
  const [room,setRoom] = useState('');
  const [roomId,setRoomId] = useState('');
  const [isHost,setIsHost] = useState(false);
  const [players,setPlayers] = useState([]);
  const [gameStatus,setGameStatus] = useState('');
  const [round,setRound] = useState(null);
  const [color,setColor] = useState('red');
  const [pressed,setPressed] = useState(false);
  const [scores,setScores] = useState([]);

  const createRoom = () => {
    socket.emit('createRoom',{name}, res => {
      if(res.ok){ setRoomId(res.roomId); setIsHost(true); setGameStatus('waiting'); }
    });
  }

  const joinRoom = () => {
    socket.emit('joinRoom',{roomId,name}, res => {
      if(res.ok){ setRoomId(res.roomId); setGameStatus('waiting'); }
      else alert(res.error);
    });
  }

  const startGame = () => { socket.emit('startGame',{rounds:3}); }

  const pressButton = () => {
    const time = Date.now();
    socket.emit('playerPress',{pressTime:time});
    setPressed(true);
  }

  useEffect(()=>{
    socket.on('roomUpdate', data=>{
      if(data && data.players) setPlayers(Object.values(data.players));
    });
    socket.on('gameStarted', g=>{
      setGameStatus('playing'); setRound(null); setPressed(false);
    });
    socket.on('roundStart', ({eventTime})=>{
      setPressed(false); setRound({eventTime});
      const rand = Math.random()<0.5?'green':'blue';
      setColor(rand);
    });
    socket.on('roundResult', data=>{
      setScores(data.scores); setRound(null);
    });
    socket.on('gameOver', data=>{
      setScores(data.scores); setGameStatus('finished'); setRound(null);
    });
  },[]);

  return (
    <div className="container">
      { !roomId &&
        <>
          <h1>Bizjaiak</h1>
          <input className="input" placeholder="Tu nombre" value={name} onChange={e=>setName(e.target.value)} />
          <button className="btn" onClick={createRoom}>Crear sala</button>
          <input className="input" placeholder="Código de sala" value={roomId} onChange={e=>setRoomId(e.target.value)} />
          <button className="btn" onClick={joinRoom}>Unirse a sala</button>
        </>
      }
      { roomId && <h2>Sala: {roomId}</h2> }
      { roomId && players.length>0 && 
        <div>
          <h3>Jugadores:</h3>
          <ul>{players.map(p=><li key={p.name}>{p.name} - {p.score}</li>)}</ul>
        </div>
      }
      { isHost && gameStatus==='waiting' && <button className="btn" onClick={startGame}>Empezar partida</button> }
      { round && <button className="player-btn" style={{background:color}} onClick={pressButton} disabled={pressed}>Pulsa!</button> }
      { scores.length>0 &&
        <>
          <h3>Ranking:</h3>
          <ul>{scores.map(p=><li key={p.id}>{p.name}: {p.score}</li>)}</ul>
        </>
      }
    </div>
  );
}

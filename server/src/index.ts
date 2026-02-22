import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { LobbyManager } from './LobbyManager.js';
import type { ServerToClientEvents, ClientToServerEvents } from 'dino-arena-shared';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: '*' },
});

const lobby = new LobbyManager();

function broadcastRoomUpdate(roomCode: string): void {
  const room = lobby.getRoom(roomCode);
  if (!room) return;
  const info = room.getRoomInfo();
  for (const player of room.players) {
    io.to(player.id).emit('room-update', info);
  }
}

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('create-room', (playerName, callback) => {
    const room = lobby.createRoom(socket.id, playerName);
    const code = room.roomCode;
    socket.join(code);
    setupRoomCallbacks(room);
    callback(code);
    broadcastRoomUpdate(code);
  });

  socket.on('join-room', (roomCode, playerName, callback) => {
    const room = lobby.joinRoom(roomCode.toUpperCase(), socket.id, playerName);
    if (!room) {
      callback(false, 'Room not found, full, or already started');
      return;
    }
    socket.join(roomCode);
    callback(true);
    broadcastRoomUpdate(roomCode);
  });

  socket.on('player-ready', () => {
    const room = lobby.getRoomByPlayer(socket.id);
    if (!room) return;
    room.setReady(socket.id);
    broadcastRoomUpdate(room.roomCode);
  });

  socket.on('start-game', () => {
    const room = lobby.getRoomByPlayer(socket.id);
    if (!room) return;
    const host = room.players.find(p => p.isHost);
    if (!host || host.id !== socket.id) return;
    room.startGame();
  });

  socket.on('player-input', (input) => {
    const room = lobby.getRoomByPlayer(socket.id);
    if (!room) return;
    room.submitInput(socket.id, input);
  });

  socket.on('play-again', () => {
    const room = lobby.getRoomByPlayer(socket.id);
    if (!room) return;
    room.resetToLobby();
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    const room = lobby.removePlayer(socket.id);
    if (room) {
      broadcastRoomUpdate(room.roomCode);
    }
  });
});

function setupRoomCallbacks(room: ReturnType<typeof lobby.createRoom>): void {
  room.onRoomUpdate = (info) => {
    for (const player of room.players) {
      io.to(player.id).emit('room-update', info);
    }
  };

  room.onRoundStart = (dinos) => {
    for (const player of room.players) {
      io.to(player.id).emit('round-start', dinos);
    }
  };

  room.onSimulationFrame = (frame) => {
    for (const player of room.players) {
      io.to(player.id).emit('simulation-frame', frame);
    }
  };

  room.onRoundEnd = (result) => {
    for (const player of room.players) {
      io.to(player.id).emit('round-end', result);
    }
  };

  room.onGameOver = (data) => {
    for (const player of room.players) {
      io.to(player.id).emit('game-over', data);
    }
  };

  room.onInputReceived = (playerId) => {
    for (const player of room.players) {
      io.to(player.id).emit('input-received', playerId);
    }
  };
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Dino Arena server running on port ${PORT}`);
});

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
    if (!player.isBot) {
      io.to(player.id).emit('room-update', info);
    }
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

  socket.on('add-bot', () => {
    const room = lobby.getRoomByPlayer(socket.id);
    if (!room) return;
    const host = room.players.find(p => p.isHost);
    if (!host || host.id !== socket.id) return;
    if (room.addBot()) {
      broadcastRoomUpdate(room.roomCode);
    }
  });

  socket.on('remove-bot', () => {
    const room = lobby.getRoomByPlayer(socket.id);
    if (!room) return;
    const host = room.players.find(p => p.isHost);
    if (!host || host.id !== socket.id) return;
    if (room.removeBot()) {
      broadcastRoomUpdate(room.roomCode);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    const room = lobby.removePlayer(socket.id);
    if (room) {
      broadcastRoomUpdate(room.roomCode);
    }
  });
});

function emitToHumans(room: ReturnType<typeof lobby.createRoom>, event: string, ...args: any[]): void {
  for (const player of room.players) {
    if (!player.isBot) {
      (io.to(player.id) as any).emit(event, ...args);
    }
  }
}

function setupRoomCallbacks(room: ReturnType<typeof lobby.createRoom>): void {
  room.onRoomUpdate = (info) => emitToHumans(room, 'room-update', info);
  room.onRoundStart = (dinos) => emitToHumans(room, 'round-start', dinos);
  room.onSimulationFrame = (frame) => emitToHumans(room, 'simulation-frame', frame);
  room.onRoundEnd = (result) => emitToHumans(room, 'round-end', result);
  room.onGameOver = (data) => emitToHumans(room, 'game-over', data);
  room.onInputReceived = (playerId) => emitToHumans(room, 'input-received', playerId);
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Dino Arena server running on port ${PORT}`);
});

import { GameRoom } from './GameRoom.js';

export class LobbyManager {
  private rooms = new Map<string, GameRoom>();

  createRoom(hostSocketId: string, hostName: string): GameRoom {
    const code = this.generateCode();
    const room = new GameRoom(code);
    room.addPlayer(hostSocketId, hostName, true);
    this.rooms.set(code, room);
    return room;
  }

  joinRoom(code: string, socketId: string, playerName: string): GameRoom | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    if (room.state !== 'lobby') return null;
    if (room.players.length >= 5) return null;
    room.addPlayer(socketId, playerName, false);
    return room;
  }

  getRoom(code: string): GameRoom | undefined {
    return this.rooms.get(code);
  }

  getRoomByPlayer(socketId: string): GameRoom | undefined {
    for (const room of this.rooms.values()) {
      if (room.hasPlayer(socketId)) return room;
    }
    return undefined;
  }

  removePlayer(socketId: string): GameRoom | undefined {
    const room = this.getRoomByPlayer(socketId);
    if (!room) return undefined;
    room.removePlayer(socketId);
    if (room.players.length === 0) {
      this.rooms.delete(room.roomCode);
      return undefined;
    }
    return room;
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    do {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }
}

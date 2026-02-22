import { io, Socket } from 'socket.io-client';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  PlayerInput,
} from 'dino-arena-shared';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

class SocketManager {
  private socket: GameSocket;
  private static instance: SocketManager;

  private constructor() {
    this.socket = io({ autoConnect: true });
  }

  static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  getSocket(): GameSocket {
    return this.socket;
  }

  createRoom(playerName: string): Promise<string> {
    return new Promise((resolve) => {
      this.socket.emit('create-room', playerName, (roomCode: string) => {
        resolve(roomCode);
      });
    });
  }

  joinRoom(roomCode: string, playerName: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.socket.emit('join-room', roomCode, playerName, (success: boolean, error?: string) => {
        resolve({ success, error });
      });
    });
  }

  setReady(): void {
    this.socket.emit('player-ready');
  }

  startGame(): void {
    this.socket.emit('start-game');
  }

  submitInput(input: PlayerInput): void {
    this.socket.emit('player-input', input);
  }

  playAgain(): void {
    this.socket.emit('play-again');
  }

  addBot(): void {
    this.socket.emit('add-bot');
  }

  removeBot(): void {
    this.socket.emit('remove-bot');
  }

  get id(): string {
    return this.socket.id || '';
  }
}

export default SocketManager;

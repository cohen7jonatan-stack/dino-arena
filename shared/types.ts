export interface Vec2 {
  x: number;
  y: number;
}

export interface PlayerInput {
  angle: number;   // radians, 0 = right, PI/2 = down
  power: number;   // 0-100
}

export interface DinoState {
  id: string;
  playerId: string;
  playerName: string;
  colorIndex: number;
  position: Vec2;
  velocity: Vec2;
  alive: boolean;
}

export interface RoomInfo {
  roomCode: string;
  players: PlayerInfo[];
  hostId: string;
  state: RoomState;
}

export interface PlayerInfo {
  id: string;
  name: string;
  colorIndex: number;
  ready: boolean;
}

export type RoomState = 'lobby' | 'input' | 'simulation' | 'gameover';

export interface SimulationFrame {
  dinos: DinoState[];
  timestamp: number;
}

export interface RoundResult {
  eliminated: string[];   // player IDs eliminated this round
  remaining: string[];    // player IDs still alive
}

export interface GameOverData {
  winnerId: string;
  winnerName: string;
}

// Socket.io event types
export interface ServerToClientEvents {
  'room-update': (room: RoomInfo) => void;
  'round-start': (dinos: DinoState[]) => void;
  'simulation-frame': (frame: SimulationFrame) => void;
  'round-end': (result: RoundResult) => void;
  'game-over': (data: GameOverData) => void;
  'error': (message: string) => void;
  'input-received': (playerId: string) => void;
}

export interface ClientToServerEvents {
  'create-room': (playerName: string, callback: (roomCode: string) => void) => void;
  'join-room': (roomCode: string, playerName: string, callback: (success: boolean, error?: string) => void) => void;
  'player-ready': () => void;
  'start-game': () => void;
  'player-input': (input: PlayerInput) => void;
  'play-again': () => void;
}

export const PLATFORM_RADIUS = 300;
export const DINO_RADIUS = 20;
export const INPUT_PHASE_DURATION = 5000;  // ms
export const SIMULATION_DURATION = 3000;   // ms
export const SIMULATION_FPS = 30;
export const MAX_FORCE = 0.05;
export const DINO_COLORS = [
  0x4CAF50,  // green
  0xF44336,  // red
  0x2196F3,  // blue
  0xFF9800,  // orange
  0x9C27B0,  // purple
];
export const DINO_COLOR_NAMES = ['Green', 'Red', 'Blue', 'Orange', 'Purple'];

import {
  RoomState, RoomInfo, PlayerInfo, PlayerInput,
  DinoState, SimulationFrame, RoundResult, GameOverData,
  PLATFORM_RADIUS, DINO_RADIUS, DINO_COLORS,
  INPUT_PHASE_DURATION, SIMULATION_DURATION, SIMULATION_FPS, MAX_FORCE,
} from 'dino-arena-shared';
import { PhysicsEngine } from './PhysicsEngine.js';
import { generateBotInput, BOT_NAMES } from './BotAI.js';

interface Player {
  id: string;
  name: string;
  colorIndex: number;
  isHost: boolean;
  isBot: boolean;
  ready: boolean;
  alive: boolean;
  input?: PlayerInput;
}

export class GameRoom {
  roomCode: string;
  players: Player[] = [];
  state: RoomState = 'lobby';
  private physics: PhysicsEngine | null = null;
  private inputTimer: ReturnType<typeof setTimeout> | null = null;
  private simInterval: ReturnType<typeof setInterval> | null = null;
  private simStartTime = 0;
  private round = 0;

  onRoomUpdate?: (room: RoomInfo) => void;
  onRoundStart?: (dinos: DinoState[]) => void;
  onSimulationFrame?: (frame: SimulationFrame) => void;
  onRoundEnd?: (result: RoundResult) => void;
  onGameOver?: (data: GameOverData) => void;
  onInputReceived?: (playerId: string) => void;

  constructor(code: string) {
    this.roomCode = code;
  }

  private botCounter = 0;

  addPlayer(id: string, name: string, isHost: boolean): void {
    const colorIndex = this.players.length;
    this.players.push({ id, name, colorIndex, isHost, isBot: false, ready: false, alive: true });
  }

  addBot(): boolean {
    if (this.players.length >= 5) return false;
    if (this.state !== 'lobby') return false;
    const colorIndex = this.players.length;
    const nameIndex = this.botCounter % BOT_NAMES.length;
    const id = `bot-${this.botCounter++}`;
    const name = BOT_NAMES[nameIndex];
    this.players.push({ id, name, colorIndex, isHost: false, isBot: true, ready: true, alive: true });
    return true;
  }

  removeBot(): boolean {
    const botIndex = this.players.findLastIndex(p => p.isBot);
    if (botIndex === -1) return false;
    this.players.splice(botIndex, 1);
    this.reassignColors();
    return true;
  }

  private reassignColors(): void {
    this.players.forEach((p, i) => { p.colorIndex = i; });
  }

  removePlayer(id: string): void {
    this.players = this.players.filter(p => p.id !== id);
    if (this.players.length > 0 && !this.players.some(p => p.isHost)) {
      const firstHuman = this.players.find(p => !p.isBot);
      if (firstHuman) firstHuman.isHost = true;
    }
    this.reassignColors();
  }

  hasPlayer(id: string): boolean {
    return this.players.some(p => p.id === id);
  }

  setReady(id: string): void {
    const player = this.players.find(p => p.id === id);
    if (player) player.ready = !player.ready;
  }

  getRoomInfo(): RoomInfo {
    return {
      roomCode: this.roomCode,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        colorIndex: p.colorIndex,
        ready: p.ready,
        isBot: p.isBot,
      })),
      hostId: this.players.find(p => p.isHost)?.id || '',
      state: this.state,
    };
  }

  startGame(): boolean {
    if (this.players.length < 2) return false;
    this.round = 0;
    this.players.forEach(p => { p.alive = true; });
    this.startNewRound();
    return true;
  }

  private startNewRound(): void {
    this.round++;
    this.state = 'input';
    this.players.forEach(p => { p.input = undefined; });

    const alivePlayers = this.players.filter(p => p.alive);
    this.physics = new PhysicsEngine(PLATFORM_RADIUS, DINO_RADIUS);
    this.physics.initDinos(alivePlayers.map(p => ({
      id: p.id,
      colorIndex: p.colorIndex,
      name: p.name,
    })));

    const dinos = this.physics.getDinoStates();
    this.onRoundStart?.(dinos);
    this.onRoomUpdate?.(this.getRoomInfo());

    // Auto-submit inputs for bots
    const aliveBots = alivePlayers.filter(p => p.isBot);
    for (const bot of aliveBots) {
      const botInput = generateBotInput(bot.id, dinos);
      bot.input = botInput;
      this.onInputReceived?.(bot.id);
    }

    // Check if all remaining players are bots (auto-advance)
    const aliveHumans = alivePlayers.filter(p => !p.isBot);
    if (aliveHumans.length === 0) {
      this.startSimulation();
      return;
    }

    this.inputTimer = setTimeout(() => {
      this.startSimulation();
    }, INPUT_PHASE_DURATION);
  }

  submitInput(playerId: string, input: PlayerInput): void {
    if (this.state !== 'input') return;
    const player = this.players.find(p => p.id === playerId);
    if (!player || !player.alive) return;
    player.input = input;
    this.onInputReceived?.(playerId);

    const alivePlayers = this.players.filter(p => p.alive);
    const allSubmitted = alivePlayers.every(p => p.input !== undefined);
    if (allSubmitted) {
      if (this.inputTimer) clearTimeout(this.inputTimer);
      this.startSimulation();
    }
  }

  private startSimulation(): void {
    if (this.state === 'simulation') return;
    this.state = 'simulation';
    this.onRoomUpdate?.(this.getRoomInfo());

    if (!this.physics) return;

    const alivePlayers = this.players.filter(p => p.alive);
    for (const player of alivePlayers) {
      if (player.input) {
        this.physics.applyForce(player.id, player.input.angle, player.input.power);
      }
    }

    this.simStartTime = Date.now();
    const frameInterval = 1000 / SIMULATION_FPS;

    this.simInterval = setInterval(() => {
      if (!this.physics) return;

      this.physics.step(frameInterval / 1000);
      const frame: SimulationFrame = {
        dinos: this.physics.getDinoStates(),
        timestamp: Date.now() - this.simStartTime,
      };
      this.onSimulationFrame?.(frame);

      if (Date.now() - this.simStartTime >= SIMULATION_DURATION) {
        this.endSimulation();
      }
    }, frameInterval);
  }

  private endSimulation(): void {
    if (this.simInterval) {
      clearInterval(this.simInterval);
      this.simInterval = null;
    }

    if (!this.physics) return;

    const dinoStates = this.physics.getDinoStates();
    const eliminated: string[] = [];
    const remaining: string[] = [];

    for (const dino of dinoStates) {
      if (!dino.alive) {
        eliminated.push(dino.playerId);
        const player = this.players.find(p => p.id === dino.playerId);
        if (player) player.alive = false;
      } else {
        remaining.push(dino.playerId);
      }
    }

    const result: RoundResult = { eliminated, remaining };
    this.onRoundEnd?.(result);

    if (remaining.length <= 1) {
      this.state = 'gameover';
      const winner = remaining.length === 1
        ? this.players.find(p => p.id === remaining[0])
        : null;
      this.onGameOver?.({
        winnerId: winner?.id || '',
        winnerName: winner?.name || 'No one',
      });
      this.onRoomUpdate?.(this.getRoomInfo());
      this.physics = null;
    } else {
      setTimeout(() => this.startNewRound(), 1500);
    }
  }

  resetToLobby(): void {
    this.state = 'lobby';
    this.players.forEach(p => {
      p.ready = p.isBot;
      p.alive = true;
      p.input = undefined;
    });
    if (this.inputTimer) clearTimeout(this.inputTimer);
    if (this.simInterval) clearInterval(this.simInterval);
    this.physics = null;
    this.onRoomUpdate?.(this.getRoomInfo());
  }

  cleanup(): void {
    if (this.inputTimer) clearTimeout(this.inputTimer);
    if (this.simInterval) clearInterval(this.simInterval);
  }
}

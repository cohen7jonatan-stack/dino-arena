import Phaser from 'phaser';
import SocketManager from '../network/SocketManager';
import type { DinoState, SimulationFrame, RoundResult, GameOverData, RoomInfo } from 'dino-arena-shared';
import {
  PLATFORM_RADIUS, DINO_RADIUS, DINO_COLORS, DINO_COLOR_NAMES,
  INPUT_PHASE_DURATION,
} from 'dino-arena-shared';

const VIEW_CENTER_X = 400;
const VIEW_CENTER_Y = 300;
const VIEW_SCALE = 0.85;

function worldToView(wx: number, wy: number): { x: number; y: number } {
  return {
    x: VIEW_CENTER_X + wx * VIEW_SCALE,
    y: VIEW_CENTER_Y + wy * VIEW_SCALE,
  };
}

export class GameScene extends Phaser.Scene {
  private platform!: Phaser.GameObjects.Arc;
  private platformEdge!: Phaser.GameObjects.Arc;
  private dinoSprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private dinos: DinoState[] = [];
  private phase: 'input' | 'simulation' | 'waiting' = 'waiting';

  // Input state
  private isDragging = false;
  private dragStart: { x: number; y: number } = { x: 0, y: 0 };
  private aimLine!: Phaser.GameObjects.Line;
  private aimArrow!: Phaser.GameObjects.Triangle;
  private powerText!: Phaser.GameObjects.Text;
  private inputSubmitted = false;

  // Timer
  private timerText!: Phaser.GameObjects.Text;
  private timerEvent: Phaser.Time.TimerEvent | null = null;
  private timeLeft = 0;

  // Status
  private phaseText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;
  private submittedPlayers: Set<string> = new Set();
  private submittedIcons: Phaser.GameObjects.Arc[] = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    const sm = SocketManager.getInstance();
    const socket = sm.getSocket();

    this.dinoSprites.clear();
    this.submittedPlayers.clear();
    this.inputSubmitted = false;
    this.phase = 'waiting';

    // Draw platform
    const pr = PLATFORM_RADIUS * VIEW_SCALE;
    this.platformEdge = this.add.circle(VIEW_CENTER_X, VIEW_CENTER_Y, pr + 4, 0x5d4e37);
    this.platform = this.add.circle(VIEW_CENTER_X, VIEW_CENTER_Y, pr, 0x8B7355);

    // Draw platform grid lines for depth perception
    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, 0x7a6a4f, 0.3);
    for (let r = 60; r < PLATFORM_RADIUS; r += 60) {
      const vr = r * VIEW_SCALE;
      gridGraphics.strokeCircle(VIEW_CENTER_X, VIEW_CENTER_Y, vr);
    }

    // Aim visuals (hidden initially)
    this.aimLine = this.add.line(0, 0, 0, 0, 0, 0, 0xffffff, 0.6).setVisible(false);
    this.aimLine.setLineWidth(2);
    this.aimArrow = this.add.triangle(0, 0, 0, -8, 16, 0, 0, 8, 0xffffff, 0.8).setVisible(false);
    this.powerText = this.add.text(0, 0, '', {
      fontSize: '16px',
      fontFamily: 'Arial Black, Arial',
      color: '#fff',
      stroke: '#000',
      strokeThickness: 3,
    }).setVisible(false);

    // HUD
    this.phaseText = this.add.text(VIEW_CENTER_X, 20, '', {
      fontSize: '22px',
      fontFamily: 'Arial Black, Arial',
      color: '#fff',
      stroke: '#000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.timerText = this.add.text(VIEW_CENTER_X, 50, '', {
      fontSize: '36px',
      fontFamily: 'Arial Black, Arial',
      color: '#FF9800',
      stroke: '#000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.roundText = this.add.text(20, 20, '', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#aaa',
    });

    // Input handling
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPointerDown(pointer));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.onPointerMove(pointer));
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.onPointerUp(pointer));

    // Socket events
    socket.on('round-start', (dinos: DinoState[]) => this.onRoundStart(dinos));
    socket.on('simulation-frame', (frame: SimulationFrame) => this.onSimFrame(frame));
    socket.on('round-end', (result: RoundResult) => this.onRoundEnd(result));
    socket.on('game-over', (data: GameOverData) => this.onGameOver(data));
    socket.on('room-update', (room: RoomInfo) => {
      if (room.state === 'lobby') {
        this.scene.start('LobbyScene', { roomCode: room.roomCode });
      }
    });
    socket.on('input-received', (playerId: string) => {
      this.submittedPlayers.add(playerId);
      this.updateSubmittedIcons();
    });

    this.events.on('shutdown', () => {
      socket.off('round-start');
      socket.off('simulation-frame');
      socket.off('round-end');
      socket.off('game-over');
      socket.off('room-update');
      socket.off('input-received');
      if (this.timerEvent) this.timerEvent.destroy();
    });
  }

  private createDinoSprite(dino: DinoState): Phaser.GameObjects.Container {
    const pos = worldToView(dino.position.x, dino.position.y);
    const color = DINO_COLORS[dino.colorIndex];
    const r = DINO_RADIUS * VIEW_SCALE;

    const container = this.add.container(pos.x, pos.y);

    // Body
    const body = this.add.circle(0, 0, r, color);
    body.setStrokeStyle(2, 0xffffff, 0.4);
    container.add(body);

    // Eyes
    const eyeOffsetX = r * 0.3;
    const eyeOffsetY = -r * 0.2;
    const eyeR = r * 0.25;
    const leftEye = this.add.circle(-eyeOffsetX, eyeOffsetY, eyeR, 0xffffff);
    const rightEye = this.add.circle(eyeOffsetX, eyeOffsetY, eyeR, 0xffffff);
    const leftPupil = this.add.circle(-eyeOffsetX, eyeOffsetY, eyeR * 0.5, 0x000000);
    const rightPupil = this.add.circle(eyeOffsetX, eyeOffsetY, eyeR * 0.5, 0x000000);
    container.add([leftEye, rightEye, leftPupil, rightPupil]);

    // Spikes on top (dino-like)
    const spike1 = this.add.triangle(0, -r - 4, -4, 4, 0, -6, 4, 4, color);
    const spike2 = this.add.triangle(-6, -r - 2, -3, 3, 0, -5, 3, 3, color);
    const spike3 = this.add.triangle(6, -r - 2, -3, 3, 0, -5, 3, 3, color);
    container.add([spike1, spike2, spike3]);

    // Name label
    const nameLabel = this.add.text(0, r + 10, dino.playerName, {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: '#fff',
      stroke: '#000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    container.add(nameLabel);

    return container;
  }

  private onRoundStart(dinos: DinoState[]): void {
    this.dinos = dinos;
    this.phase = 'input';
    this.inputSubmitted = false;
    this.submittedPlayers.clear();
    this.isDragging = false;

    // Clear old sprites
    this.dinoSprites.forEach(s => s.destroy());
    this.dinoSprites.clear();

    // Create new sprites
    for (const dino of dinos) {
      if (dino.alive) {
        const sprite = this.createDinoSprite(dino);
        this.dinoSprites.set(dino.playerId, sprite);
      }
    }

    this.phaseText.setText('Choose your move!');
    this.roundText.setText(`Alive: ${dinos.filter(d => d.alive).length}`);

    // Start countdown
    this.timeLeft = INPUT_PHASE_DURATION / 1000;
    this.timerText.setText(String(this.timeLeft));
    if (this.timerEvent) this.timerEvent.destroy();
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: () => {
        this.timeLeft--;
        this.timerText.setText(this.timeLeft > 0 ? String(this.timeLeft) : '');
      },
      repeat: this.timeLeft - 1,
    });

    this.updateSubmittedIcons();
  }

  private updateSubmittedIcons(): void {
    this.submittedIcons.forEach(ic => ic.destroy());
    this.submittedIcons = [];

    const aliveDinos = this.dinos.filter(d => d.alive);
    aliveDinos.forEach((dino, i) => {
      const x = 700 + (i % 3) * 30;
      const y = 20 + Math.floor(i / 3) * 30;
      const submitted = this.submittedPlayers.has(dino.playerId);
      const ic = this.add.circle(x, y, 8, DINO_COLORS[dino.colorIndex], submitted ? 1 : 0.3);
      ic.setStrokeStyle(1, 0xffffff, 0.5);
      this.submittedIcons.push(ic);
    });
  }

  private getMyDino(): DinoState | undefined {
    const sm = SocketManager.getInstance();
    return this.dinos.find(d => d.playerId === sm.id && d.alive);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.phase !== 'input' || this.inputSubmitted) return;
    const myDino = this.getMyDino();
    if (!myDino) return;

    const myPos = worldToView(myDino.position.x, myDino.position.y);
    const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, myPos.x, myPos.y);
    if (dist > 60) return;

    this.isDragging = true;
    this.dragStart = { x: myPos.x, y: myPos.y };
    this.aimLine.setVisible(true);
    this.powerText.setVisible(true);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isDragging) return;
    const myDino = this.getMyDino();
    if (!myDino) return;

    const myPos = worldToView(myDino.position.x, myDino.position.y);
    const dx = pointer.x - myPos.x;
    const dy = pointer.y - myPos.y;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), 150);
    const angle = Math.atan2(dy, dx);
    const power = Math.round((dist / 150) * 100);

    // Draw aim line in the direction of the drag (the dino will move this way)
    const endX = myPos.x + Math.cos(angle) * dist;
    const endY = myPos.y + Math.sin(angle) * dist;
    this.aimLine.setTo(myPos.x, myPos.y, endX, endY);

    // Arrow at end
    this.aimArrow.setPosition(endX, endY);
    this.aimArrow.setRotation(angle);
    this.aimArrow.setVisible(true);

    // Power display
    const color = power > 70 ? '#FF5722' : power > 40 ? '#FF9800' : '#4CAF50';
    this.powerText.setText(`${power}%`);
    this.powerText.setPosition(endX + 15, endY - 15);
    this.powerText.setColor(color);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.isDragging) return;
    this.isDragging = false;

    const myDino = this.getMyDino();
    if (!myDino) return;

    const myPos = worldToView(myDino.position.x, myDino.position.y);
    const dx = pointer.x - myPos.x;
    const dy = pointer.y - myPos.y;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), 150);
    const angle = Math.atan2(dy, dx);
    const power = Math.round((dist / 150) * 100);

    if (power < 5) {
      this.aimLine.setVisible(false);
      this.aimArrow.setVisible(false);
      this.powerText.setVisible(false);
      return;
    }

    this.inputSubmitted = true;
    this.phase = 'waiting';
    this.phaseText.setText('Move submitted! Waiting...');
    this.aimLine.setVisible(false);
    this.aimArrow.setVisible(false);
    this.powerText.setVisible(false);

    const sm = SocketManager.getInstance();
    sm.submitInput({ angle, power });
  }

  private onSimFrame(frame: SimulationFrame): void {
    this.phase = 'simulation';
    this.phaseText.setText('Charge!');
    this.timerText.setText('');

    for (const dino of frame.dinos) {
      const sprite = this.dinoSprites.get(dino.playerId);
      if (!sprite) continue;

      if (!dino.alive) {
        // Falling off animation
        this.tweens.add({
          targets: sprite,
          alpha: 0,
          scale: 0.3,
          duration: 400,
          onComplete: () => sprite.destroy(),
        });
        this.dinoSprites.delete(dino.playerId);

        // Particle burst
        const pos = worldToView(dino.position.x, dino.position.y);
        const color = DINO_COLORS[dino.colorIndex];
        for (let i = 0; i < 8; i++) {
          const p = this.add.circle(pos.x, pos.y, 4, color);
          const a = (Math.PI * 2 * i) / 8;
          this.tweens.add({
            targets: p,
            x: pos.x + Math.cos(a) * 40,
            y: pos.y + Math.sin(a) * 40,
            alpha: 0,
            duration: 500,
            onComplete: () => p.destroy(),
          });
        }
        continue;
      }

      const pos = worldToView(dino.position.x, dino.position.y);
      sprite.setPosition(pos.x, pos.y);
    }
  }

  private onRoundEnd(result: RoundResult): void {
    this.dinos = this.dinos.map(d => ({
      ...d,
      alive: result.remaining.includes(d.playerId),
    }));

    if (result.eliminated.length > 0) {
      const names = result.eliminated.map(id => {
        const d = this.dinos.find(dd => dd.playerId === id);
        return d?.playerName || 'Unknown';
      });
      this.phaseText.setText(`${names.join(', ')} eliminated!`);
    }

    this.roundText.setText(`Alive: ${result.remaining.length}`);
  }

  private onGameOver(data: GameOverData): void {
    this.scene.start('GameOverScene', { winnerName: data.winnerName, winnerId: data.winnerId });
  }
}

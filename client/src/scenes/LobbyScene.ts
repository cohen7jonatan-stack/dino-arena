import Phaser from 'phaser';
import SocketManager from '../network/SocketManager';
import type { RoomInfo } from 'dino-arena-shared';
import { DINO_COLORS, DINO_COLOR_NAMES } from 'dino-arena-shared';

export class LobbyScene extends Phaser.Scene {
  private roomCode = '';
  private playerName = '';
  private playerTexts: Phaser.GameObjects.Text[] = [];
  private readyDots: Phaser.GameObjects.Arc[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private startBtn!: Phaser.GameObjects.Text;
  private readyBtn!: Phaser.GameObjects.Text;
  private addBotBtn!: Phaser.GameObjects.Text;
  private removeBotBtn!: Phaser.GameObjects.Text;
  private roomInfo: RoomInfo | null = null;

  constructor() {
    super({ key: 'LobbyScene' });
  }

  init(data: { roomCode: string; playerName: string }): void {
    this.roomCode = data.roomCode;
    this.playerName = data.playerName;
  }

  create(): void {
    const { width } = this.scale;
    const sm = SocketManager.getInstance();
    const socket = sm.getSocket();

    this.add.text(width / 2, 40, 'LOBBY', {
      fontSize: '32px',
      fontFamily: 'Arial Black, Arial',
      color: '#fff',
    }).setOrigin(0.5);

    this.add.text(width / 2, 80, `Room Code: ${this.roomCode}`, {
      fontSize: '28px',
      fontFamily: 'monospace',
      color: '#4CAF50',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(width / 2, 110, '(share this code with friends)', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#888',
    }).setOrigin(0.5);

    this.add.text(width / 2, 160, 'Players:', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#ccc',
    }).setOrigin(0.5);

    this.statusText = this.add.text(width / 2, 500, 'Waiting for players...', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#888',
    }).setOrigin(0.5);

    this.readyBtn = this.add.text(width / 2, 440, '[ READY ]', {
      fontSize: '24px',
      fontFamily: 'Arial Black, Arial',
      color: '#2196F3',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.readyBtn.on('pointerdown', () => sm.setReady());

    this.startBtn = this.add.text(width / 2, 480, '[ START GAME ]', {
      fontSize: '24px',
      fontFamily: 'Arial Black, Arial',
      color: '#4CAF50',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setVisible(false);
    this.startBtn.on('pointerdown', () => sm.startGame());

    this.addBotBtn = this.add.text(width / 2 - 80, 530, '[ + BOT ]', {
      fontSize: '18px',
      fontFamily: 'Arial Black, Arial',
      color: '#FF9800',
      stroke: '#000',
      strokeThickness: 2,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setVisible(false);
    this.addBotBtn.on('pointerdown', () => sm.addBot());
    this.addBotBtn.on('pointerover', () => this.addBotBtn.setColor('#FFB74D'));
    this.addBotBtn.on('pointerout', () => this.addBotBtn.setColor('#FF9800'));

    this.removeBotBtn = this.add.text(width / 2 + 80, 530, '[ - BOT ]', {
      fontSize: '18px',
      fontFamily: 'Arial Black, Arial',
      color: '#F44336',
      stroke: '#000',
      strokeThickness: 2,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setVisible(false);
    this.removeBotBtn.on('pointerdown', () => sm.removeBot());
    this.removeBotBtn.on('pointerover', () => this.removeBotBtn.setColor('#EF5350'));
    this.removeBotBtn.on('pointerout', () => this.removeBotBtn.setColor('#F44336'));

    socket.on('room-update', (room: RoomInfo) => {
      this.roomInfo = room;
      this.updatePlayerList(room);
      if (room.state === 'input' || room.state === 'simulation') {
        this.scene.start('GameScene', { roomCode: this.roomCode });
      }
    });

    socket.on('round-start', (dinos) => {
      this.scene.start('GameScene', { roomCode: this.roomCode, initialDinos: dinos });
    });

    this.events.on('shutdown', () => {
      socket.off('room-update');
      socket.off('round-start');
    });
  }

  private updatePlayerList(room: RoomInfo): void {
    const { width } = this.scale;
    const sm = SocketManager.getInstance();

    this.playerTexts.forEach(t => t.destroy());
    this.readyDots.forEach(d => d.destroy());
    this.playerTexts = [];
    this.readyDots = [];

    room.players.forEach((player, i) => {
      const y = 200 + i * 45;
      const colorNum = DINO_COLORS[player.colorIndex];
      const colorStr = '#' + colorNum.toString(16).padStart(6, '0');

      const dot = this.add.circle(width / 2 - 120, y, 8, player.ready ? 0x4CAF50 : 0x666666);
      this.readyDots.push(dot);

      const hostTag = player.id === room.hostId ? ' [HOST]' : '';
      const youTag = player.id === sm.id ? ' (you)' : '';
      const botTag = player.isBot ? ' [BOT]' : '';
      const dinoColor = DINO_COLOR_NAMES[player.colorIndex];
      const text = this.add.text(width / 2 - 100, y, `${player.name}${hostTag}${youTag}${botTag} — ${dinoColor} Dino`, {
        fontSize: '18px',
        fontFamily: 'Arial',
        color: colorStr,
      }).setOrigin(0, 0.5);
      this.playerTexts.push(text);
    });

    const isHost = room.hostId === sm.id;
    const enoughPlayers = room.players.length >= 2;
    const hasBots = room.players.some(p => p.isBot);
    const isFull = room.players.length >= 5;
    this.startBtn.setVisible(isHost && enoughPlayers);
    this.addBotBtn.setVisible(isHost && !isFull);
    this.removeBotBtn.setVisible(isHost && hasBots);

    if (room.players.length < 2) {
      this.statusText.setText('Need at least 2 players (add bots or invite friends)');
    } else if (isHost) {
      this.statusText.setText('Press START GAME when ready!');
    } else {
      this.statusText.setText('Waiting for host to start...');
    }
  }
}

import Phaser from 'phaser';
import SocketManager from '../network/SocketManager';

export class GameOverScene extends Phaser.Scene {
  private winnerName = '';
  private winnerId = '';

  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data: { winnerName: string; winnerId: string }): void {
    this.winnerName = data.winnerName;
    this.winnerId = data.winnerId;
  }

  create(): void {
    const { width, height } = this.scale;
    const sm = SocketManager.getInstance();
    const isMe = this.winnerId === sm.id;

    this.add.text(width / 2, height / 2 - 80, isMe ? 'YOU WIN!' : 'GAME OVER', {
      fontSize: '48px',
      fontFamily: 'Arial Black, Arial',
      color: isMe ? '#4CAF50' : '#F44336',
      stroke: '#000',
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 - 20, `${this.winnerName} is the last dino standing!`, {
      fontSize: '22px',
      fontFamily: 'Arial',
      color: '#fff',
    }).setOrigin(0.5);

    // Trophy animation
    const trophy = this.add.text(width / 2, height / 2 + 40, '🏆', {
      fontSize: '64px',
    }).setOrigin(0.5);
    this.tweens.add({
      targets: trophy,
      scaleX: 1.2,
      scaleY: 1.2,
      yoyo: true,
      repeat: -1,
      duration: 600,
      ease: 'Sine.easeInOut',
    });

    const playAgainBtn = this.add.text(width / 2, height / 2 + 140, '[ PLAY AGAIN ]', {
      fontSize: '28px',
      fontFamily: 'Arial Black, Arial',
      color: '#4CAF50',
      stroke: '#000',
      strokeThickness: 4,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    playAgainBtn.on('pointerdown', () => {
      sm.playAgain();
    });

    playAgainBtn.on('pointerover', () => playAgainBtn.setColor('#66BB6A'));
    playAgainBtn.on('pointerout', () => playAgainBtn.setColor('#4CAF50'));

    const menuBtn = this.add.text(width / 2, height / 2 + 190, '[ MAIN MENU ]', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#888',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    menuBtn.on('pointerdown', () => {
      this.scene.start('MenuScene');
    });
    menuBtn.on('pointerover', () => menuBtn.setColor('#aaa'));
    menuBtn.on('pointerout', () => menuBtn.setColor('#888'));

    const socket = sm.getSocket();
    socket.on('room-update', (room) => {
      if (room.state === 'lobby') {
        this.scene.start('LobbyScene', { roomCode: room.roomCode, playerName: '' });
      }
    });

    this.events.on('shutdown', () => {
      socket.off('room-update');
    });
  }
}

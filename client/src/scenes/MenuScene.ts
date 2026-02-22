import Phaser from 'phaser';
import SocketManager from '../network/SocketManager';

export class MenuScene extends Phaser.Scene {
  private nameInput!: HTMLInputElement;
  private codeInput!: HTMLInputElement;
  private container!: HTMLDivElement;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    this.add.text(width / 2, 80, 'DINO ARENA', {
      fontSize: '48px',
      fontFamily: 'Arial Black, Arial',
      color: '#4CAF50',
      stroke: '#000',
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(width / 2, 130, 'Last Dino Standing Wins!', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#aaa',
    }).setOrigin(0.5);

    this.container = document.createElement('div');
    Object.assign(this.container.style, {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -30%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
      zIndex: '10',
    });

    this.nameInput = this.createInput('Your Name');
    this.container.appendChild(this.nameInput);

    const playAiBtn = this.createButton('Play vs AI', '#FF9800');
    playAiBtn.addEventListener('click', () => this.handlePlayVsAI());
    this.container.appendChild(playAiBtn);

    const createBtn = this.createButton('Create Room', '#4CAF50');
    createBtn.addEventListener('click', () => this.handleCreate());
    this.container.appendChild(createBtn);

    const divider = document.createElement('div');
    divider.textContent = '— OR —';
    Object.assign(divider.style, { color: '#888', margin: '8px 0', fontFamily: 'Arial', fontSize: '14px' });
    this.container.appendChild(divider);

    this.codeInput = this.createInput('Room Code');
    this.codeInput.maxLength = 4;
    this.codeInput.style.textTransform = 'uppercase';
    this.codeInput.style.textAlign = 'center';
    this.codeInput.style.letterSpacing = '4px';
    this.container.appendChild(this.codeInput);

    const joinBtn = this.createButton('Join Room', '#2196F3');
    joinBtn.addEventListener('click', () => this.handleJoin());
    this.container.appendChild(joinBtn);

    document.body.appendChild(this.container);

    this.events.on('shutdown', () => {
      this.container.remove();
    });
  }

  private createInput(placeholder: string): HTMLInputElement {
    const input = document.createElement('input');
    input.placeholder = placeholder;
    Object.assign(input.style, {
      padding: '12px 16px',
      fontSize: '18px',
      border: '2px solid #444',
      borderRadius: '8px',
      background: '#2a2a3e',
      color: '#fff',
      outline: 'none',
      width: '220px',
      fontFamily: 'Arial',
    });
    input.addEventListener('focus', () => { input.style.borderColor = '#4CAF50'; });
    input.addEventListener('blur', () => { input.style.borderColor = '#444'; });
    return input;
  }

  private createButton(text: string, color: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    Object.assign(btn.style, {
      padding: '12px 32px',
      fontSize: '16px',
      fontWeight: 'bold',
      border: 'none',
      borderRadius: '8px',
      background: color,
      color: '#fff',
      cursor: 'pointer',
      fontFamily: 'Arial',
      width: '220px',
      transition: 'opacity 0.2s',
    });
    btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.85'; });
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '1'; });
    return btn;
  }

  private async handlePlayVsAI(): Promise<void> {
    const name = this.nameInput.value.trim();
    if (!name) { this.nameInput.style.borderColor = '#F44336'; return; }
    const sm = SocketManager.getInstance();
    const roomCode = await sm.createRoom(name);
    // Add 3 bots
    sm.addBot();
    sm.addBot();
    sm.addBot();
    this.scene.start('LobbyScene', { roomCode, playerName: name });
  }

  private async handleCreate(): Promise<void> {
    const name = this.nameInput.value.trim();
    if (!name) { this.nameInput.style.borderColor = '#F44336'; return; }
    const sm = SocketManager.getInstance();
    const roomCode = await sm.createRoom(name);
    this.scene.start('LobbyScene', { roomCode, playerName: name });
  }

  private async handleJoin(): Promise<void> {
    const name = this.nameInput.value.trim();
    if (!name) { this.nameInput.style.borderColor = '#F44336'; return; }
    const code = this.codeInput.value.trim().toUpperCase();
    if (!code || code.length !== 4) { this.codeInput.style.borderColor = '#F44336'; return; }
    const sm = SocketManager.getInstance();
    const result = await sm.joinRoom(code, name);
    if (result.success) {
      this.scene.start('LobbyScene', { roomCode: code, playerName: name });
    } else {
      this.codeInput.style.borderColor = '#F44336';
      this.codeInput.value = '';
      this.codeInput.placeholder = result.error || 'Failed';
    }
  }
}

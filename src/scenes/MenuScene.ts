import Phaser from 'phaser';
import { ALL_COLORS, getBubbleTextureKey } from '../game/Bubble';
import { fadeOutAndStart, fadeIn } from '../utils/transition';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    fadeIn(this);
    this.createBackground();
    this.createTitle();
    this.createFloatingBubbles();
    this.createPlayButton();
    this.createNavLabels();
  }

  private createBackground(): void {
    this.add
      .rectangle(
        this.scale.width / 2,
        this.scale.height / 2,
        this.scale.width,
        this.scale.height,
        0x050510,
      )
      .setDepth(-1);

    for (let i = 0; i < 80; i++) {
      this.add.circle(
        Phaser.Math.Between(0, this.scale.width),
        Phaser.Math.Between(0, this.scale.height),
        Phaser.Math.FloatBetween(0.5, 1.5),
        0xffffff,
        Phaser.Math.FloatBetween(0.2, 0.7),
      );
    }
  }

  private createTitle(): void {
    const cx = this.scale.width / 2;
    const cy = 160;

    this.add
      .text(cx, cy, 'BUBBLE SPY', {
        fontSize: '42px',
        color: '#00e5ff',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        shadow: {
          offsetX: 0,
          offsetY: 0,
          blur: 20,
          color: '#00e5ff',
          fill: true,
          stroke: true,
        },
      })
      .setOrigin(0.5);
  }

  private createFloatingBubbles(): void {
    this.time.addEvent({
      delay: 800,
      callback: () => this.spawnFloatingBubble(),
      loop: true,
    });
  }

  private spawnFloatingBubble(): void {
    const color = ALL_COLORS[Math.floor(Math.random() * ALL_COLORS.length)];
    const x = Phaser.Math.Between(30, this.scale.width - 30);
    const y = this.scale.height + 30;

    const bubble = this.add
      .image(x, y, getBubbleTextureKey(color))
      .setScale(Phaser.Math.FloatBetween(0.4, 0.8))
      .setAlpha(Phaser.Math.FloatBetween(0.3, 0.6));

    this.tweens.add({
      targets: bubble,
      y: -50,
      x: x + Phaser.Math.Between(-40, 40),
      duration: Phaser.Math.Between(4000, 8000),
      onComplete: () => bubble.destroy(),
    });
  }

  private createPlayButton(): void {
    const cx = this.scale.width / 2;
    const cy = 380;

    const playBtn = this.add
      .text(cx, cy, '[ PLAY ]', {
        fontSize: '24px',
        color: '#69f0ae',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    playBtn.on('pointerover', () => playBtn.setColor('#a5d6a7'));
    playBtn.on('pointerout', () => playBtn.setColor('#69f0ae'));
    playBtn.on('pointerdown', () => {
      fadeOutAndStart(this, 'MapScene');
    });
  }

  private createNavLabels(): void {
    this.add
      .text(30, this.scale.height - 40, 'SETTINGS', {
        fontSize: '10px',
        color: '#8892b0',
        fontFamily: 'monospace',
      })
      .setOrigin(0, 0.5);

    this.add
      .text(this.scale.width - 30, this.scale.height - 40, 'LEADERBOARD', {
        fontSize: '10px',
        color: '#8892b0',
        fontFamily: 'monospace',
      })
      .setOrigin(1, 0.5);
  }
}

import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';

export class UIScene extends Phaser.Scene {
  private scoreTxt!: Phaser.GameObjects.Text;
  private movesTxt!: Phaser.GameObjects.Text;
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressBg!: Phaser.GameObjects.Graphics;

  private score = 0;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    const game = this.scene.get('GameScene');

    this.drawHudBackground();

    this.scoreTxt = this.add.text(12, 8, 'SCORE: 0', {
      fontSize: '14px', color: '#00e5ff', fontFamily: 'monospace',
    });

    this.movesTxt = this.add.text(GAME_WIDTH - 12, 8, 'MOVES: --', {
      fontSize: '14px', color: '#00e5ff', fontFamily: 'monospace',
    }).setOrigin(1, 0);

    this.progressBg = this.add.graphics();
    this.progressBar = this.add.graphics();
    this.drawProgressBar(1);

    game.events.on('score-update', (s: number) => {
      this.score = s;
      this.animateScore();
    });

    game.events.on('moves-update', (m: number) => {
      this.movesTxt.setText(`MOVES: ${m}`);
      if (m <= 5) this.movesTxt.setColor('#ff4081');
    });

    game.events.on('progress-update', (remaining: number, total: number) => {
      this.drawProgressBar(remaining / total);
    });
  }

  private drawHudBackground(): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x0a1428, 0.85);
    bg.fillRect(0, 0, GAME_WIDTH, 36);
  }

  private drawProgressBar(fraction: number): void {
    const BAR_X = GAME_WIDTH / 2 - 80;
    const BAR_Y = 12;
    const BAR_W = 160;
    const BAR_H = 12;

    this.progressBg.clear();
    this.progressBg.fillStyle(0x1a2540);
    this.progressBg.fillRect(BAR_X, BAR_Y, BAR_W, BAR_H);

    this.progressBar.clear();
    const filled = Phaser.Math.Clamp(1 - fraction, 0, 1);
    this.progressBar.fillStyle(0x00e5ff);
    this.progressBar.fillRect(BAR_X, BAR_Y, BAR_W * filled, BAR_H);

    this.progressBg.lineStyle(1, 0xffd600, 0.7);
    [0.33, 0.66, 1.0].forEach((t) => {
      const mx = BAR_X + BAR_W * t;
      this.progressBg.lineBetween(mx, BAR_Y - 2, mx, BAR_Y + BAR_H + 2);
    });
  }

  private animateScore(): void {
    this.scoreTxt.setText(`SCORE: ${this.score}`);
    this.tweens.add({
      targets: this.scoreTxt,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 80,
      yoyo: true,
    });
  }
}

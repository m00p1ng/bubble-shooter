import Phaser from 'phaser';
import { ALL_COLORS, COLOR_CONFIG, getBubbleTextureKey, getShooterTextureKey } from '../game/Bubble';
import { BUBBLE_RADIUS } from '../config';
import { AudioManager } from '../audio/AudioManager';
import { createStarfield } from '../utils/starfield';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    createStarfield(this);

    for (let i = 1; i <= 10; i++) {
      const id = i.toString().padStart(3, '0');
      this.load.json(`level-${i}`, `data/levels/level-${id}.json`);
    }

    const bar = this.add.graphics();
    this.load.on('progress', (v: number) => {
      bar.clear();
      bar.fillStyle(0x00e5ff);
      bar.fillRect(40, this.scale.height / 2 - 8, (this.scale.width - 80) * v, 16);
    });
  }

  create(): void {
    this.generateBubbleTextures();
    this.generateShooterTexture();
    this.generateParticleTexture();
    AudioManager.getInstance().init(this);
    this.scene.start('MenuScene');
  }

  private generateBubbleTextures(): void {
    const size = BUBBLE_RADIUS * 2;
    for (const color of ALL_COLORS) {
      const key = getBubbleTextureKey(color);
      if (this.textures.exists(key)) continue;
      const ct = this.textures.createCanvas(key, size, size)!;
      const ctx = ct.context;
      const { base, glow } = COLOR_CONFIG[color];

      const grad = ctx.createRadialGradient(
        BUBBLE_RADIUS * 0.6, BUBBLE_RADIUS * 0.4, 2,
        BUBBLE_RADIUS, BUBBLE_RADIUS, BUBBLE_RADIUS,
      );
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.25, base);
      grad.addColorStop(1, glow);

      ctx.beginPath();
      ctx.arc(BUBBLE_RADIUS, BUBBLE_RADIUS, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(BUBBLE_RADIUS, BUBBLE_RADIUS, BUBBLE_RADIUS - 2, 0, Math.PI * 2);
      ctx.strokeStyle = glow;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.55;
      ctx.stroke();
      ctx.globalAlpha = 1;

      ct.refresh();
    }
  }

  private generateParticleTexture(): void {
    const key = 'particle';
    if (this.textures.exists(key)) return;
    const ct = this.textures.createCanvas(key, 8, 8)!;
    const ctx = ct.context;
    const grad = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 8, 8);
    ct.refresh();
  }

  private generateShooterTexture(): void {
    const key = getShooterTextureKey();
    if (this.textures.exists(key)) return;
    const ct = this.textures.createCanvas(key, 40, 50)!;
    const ctx = ct.context;

    ctx.fillStyle = '#00e5ff';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(38, 50);
    ctx.lineTo(2, 50);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#7c4dff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ct.refresh();
  }
}

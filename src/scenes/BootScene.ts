import Phaser from 'phaser';
import {
  ALL_COLORS,
  COLOR_CONFIG,
  getBubbleTextureKey,
  getShooterCradleTextureKey,
  getShooterTextureKey,
} from '../game/Bubble';
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
    this.generateShooterCradleTexture();
    this.generateSpecialBubbleTextures();
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

  private generateShooterCradleTexture(): void {
    const key = getShooterCradleTextureKey();
    if (this.textures.exists(key)) return;

    const size = 92;
    const center = size / 2;
    const texture = this.textures.createCanvas(key, size, size)!;
    const ctx = texture.context;

    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(center, center, 38, Math.PI * 0.12, Math.PI * 0.88, true);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#7c4dff';
    ctx.beginPath();
    ctx.moveTo(center - 28, size - 16);
    ctx.lineTo(center + 28, size - 16);
    ctx.lineTo(center + 36, size - 2);
    ctx.lineTo(center - 36, size - 2);
    ctx.closePath();
    ctx.fill();

    texture.refresh();
  }

  private generateSpecialBubbleTextures(): void {
    const size = BUBBLE_RADIUS * 2;

    for (const color of ALL_COLORS) {
      const stoneKey = getBubbleTextureKey(color, 'STONE');
      if (!this.textures.exists(stoneKey)) {
        const texture = this.textures.createCanvas(stoneKey, size, size)!;
        const ctx = texture.context;
        ctx.fillStyle = '#555555';
        ctx.beginPath();
        ctx.arc(BUBBLE_RADIUS, BUBBLE_RADIUS, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(BUBBLE_RADIUS * 0.3, BUBBLE_RADIUS * 0.3);
        ctx.lineTo(BUBBLE_RADIUS * 0.5, BUBBLE_RADIUS * 0.6);
        ctx.lineTo(BUBBLE_RADIUS * 0.7, BUBBLE_RADIUS * 0.4);
        ctx.stroke();
        texture.refresh();
      }

      const bombKey = getBubbleTextureKey(color, 'BOMB');
      if (!this.textures.exists(bombKey)) {
        const texture = this.textures.createCanvas(bombKey, size, size)!;
        const ctx = texture.context;
        const { base } = COLOR_CONFIG[color];
        const gradient = ctx.createRadialGradient(
          BUBBLE_RADIUS * 0.5,
          BUBBLE_RADIUS * 0.5,
          2,
          BUBBLE_RADIUS,
          BUBBLE_RADIUS,
          BUBBLE_RADIUS,
        );
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.3, base);
        gradient.addColorStop(1, '#ff0000');
        ctx.beginPath();
        ctx.arc(BUBBLE_RADIUS, BUBBLE_RADIUS, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = '#ffd600';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(BUBBLE_RADIUS, 2);
        ctx.lineTo(BUBBLE_RADIUS, -4);
        ctx.stroke();
        texture.refresh();
      }

      const wildcardKey = getBubbleTextureKey(color, 'WILDCARD');
      if (!this.textures.exists(wildcardKey)) {
        const texture = this.textures.createCanvas(wildcardKey, size, size)!;
        const ctx = texture.context;
        const gradient = ctx.createRadialGradient(
          BUBBLE_RADIUS * 0.5,
          BUBBLE_RADIUS * 0.5,
          2,
          BUBBLE_RADIUS,
          BUBBLE_RADIUS,
          BUBBLE_RADIUS,
        );
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.2, '#ff6b6b');
        gradient.addColorStop(0.4, '#fff176');
        gradient.addColorStop(0.6, '#69f0ae');
        gradient.addColorStop(0.8, '#7986ff');
        gradient.addColorStop(1, '#ce93d8');
        ctx.beginPath();
        ctx.arc(BUBBLE_RADIUS, BUBBLE_RADIUS, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', BUBBLE_RADIUS, BUBBLE_RADIUS);
        texture.refresh();
      }
    }
  }
}

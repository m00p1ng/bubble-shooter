import Phaser from 'phaser';
import type { BubbleColor } from './Bubble';
import { COLOR_CONFIG } from './Bubble';
import { BUBBLE_RADIUS } from '../config';

export class Effects {
  constructor(private scene: Phaser.Scene) {}

  popBurst(x: number, y: number, color: BubbleColor): void {
    const hexColor = parseInt(COLOR_CONFIG[color].glow.replace('#', ''), 16);
    const COUNT = 14;

    for (let i = 0; i < COUNT; i++) {
      const angle = (i / COUNT) * Math.PI * 2;
      const speed = Phaser.Math.Between(60, 140);
      const radius = BUBBLE_RADIUS * 0.4;

      const dot = this.scene.add.circle(x, y, radius, hexColor, 1);
      this.scene.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        scaleX: 0,
        scaleY: 0,
        alpha: 0,
        duration: Phaser.Math.Between(300, 500),
        ease: 'Power2',
        onComplete: () => dot.destroy(),
      });
    }
  }
}

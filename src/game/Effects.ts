import Phaser from 'phaser';
import type { BubbleColor } from './Bubble';
import { COLOR_CONFIG } from './Bubble';
import { POP_PARTICLE_COUNT, POP_PARTICLE_SPEED_MIN, POP_PARTICLE_SPEED_MAX, POP_PARTICLE_LIFETIME } from '../config';

export class Effects {
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private scene: Phaser.Scene) {
    this.emitter = scene.add.particles(0, 0, 'particle', {
      speed: { min: POP_PARTICLE_SPEED_MIN, max: POP_PARTICLE_SPEED_MAX },
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: POP_PARTICLE_LIFETIME,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
  }

  popBurst(x: number, y: number, color: BubbleColor): void {
    const hexColor = parseInt(COLOR_CONFIG[color].glow.replace('#', ''), 16);
    this.emitter.setParticleTint(hexColor);
    this.emitter.explode(POP_PARTICLE_COUNT, x, y);
  }

  shakeCamera(matchCount: number): void {
    const intensity = 0.005 * matchCount;
    this.scene.cameras.main.shake(150, intensity);
  }
}

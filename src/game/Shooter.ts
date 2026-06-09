import Phaser from 'phaser';
import type { BubbleColor } from './Bubble';
import { getBubbleTextureKey } from './Bubble';
import { SHOOTER_X, SHOOTER_Y, BUBBLE_RADIUS, MIN_SHOOT_ANGLE, SHOOT_COOLDOWN, BUBBLE_IDLE_PULSE_SCALE, BUBBLE_IDLE_PULSE_DURATION } from '../config';

export class Shooter extends Phaser.Events.EventEmitter {
  private currentSprite!: Phaser.GameObjects.Image;
  private nextSprite!: Phaser.GameObjects.Image;
  private aimAngle = 0;
  private cooldown = false;

  currentColor!: BubbleColor;
  nextColor!: BubbleColor;

  constructor(
    private scene: Phaser.Scene,
    private availableColors: BubbleColor[],
  ) {
    super();
    this.currentColor = this.randomColor();
    this.nextColor = this.randomColor();
    this.createSprites();
  }

  private createSprites(): void {
    this.currentSprite = this.scene.add.image(SHOOTER_X, SHOOTER_Y - BUBBLE_RADIUS * 1.5, getBubbleTextureKey(this.currentColor));
    this.scene.tweens.add({
      targets: this.currentSprite,
      scaleX: BUBBLE_IDLE_PULSE_SCALE,
      scaleY: BUBBLE_IDLE_PULSE_SCALE,
      duration: BUBBLE_IDLE_PULSE_DURATION / 2,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.nextSprite = this.scene.add.image(SHOOTER_X + 52, SHOOTER_Y + 10, getBubbleTextureKey(this.nextColor)).setScale(0.75);
    this.scene.add.text(SHOOTER_X + 52, SHOOTER_Y + 28, 'NEXT', {
      fontSize: '10px', color: '#8892b0', fontFamily: 'monospace',
    }).setOrigin(0.5);
  }

  setAimAngle(angle: number): void {
    const halfPi = Math.PI / 2;
    this.aimAngle = Phaser.Math.Clamp(angle, -(halfPi - MIN_SHOOT_ANGLE), halfPi - MIN_SHOOT_ANGLE);
  }

  fire(): void {
    if (this.cooldown) return;
    this.cooldown = true;

    this.scene.tweens.add({
      targets: this.currentSprite,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 50,
      yoyo: true,
    });

    this.emit('fire', this.currentColor, this.aimAngle);

    this.currentColor = this.nextColor;
    this.nextColor = this.randomColor();
    this.currentSprite.setTexture(getBubbleTextureKey(this.currentColor));
    this.nextSprite.setTexture(getBubbleTextureKey(this.nextColor));

    this.scene.time.delayedCall(SHOOT_COOLDOWN, () => { this.cooldown = false; });
  }

  private randomColor(): BubbleColor {
    return this.availableColors[Math.floor(Math.random() * this.availableColors.length)];
  }

  destroy(): void {
    this.currentSprite.destroy();
    this.nextSprite.destroy();
    this.removeAllListeners();
  }
}

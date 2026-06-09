import Phaser from 'phaser';
import type { BubbleColor, BubbleType } from './Bubble';
import {
  getBubbleTextureKey,
  getShooterCradleTextureKey,
} from './Bubble';
import {
  SHOOTER_X,
  SHOOTER_Y,
  BUBBLE_RADIUS,
  MIN_SHOOT_ANGLE,
  SHOOT_COOLDOWN,
  BUBBLE_IDLE_PULSE_SCALE,
  BUBBLE_IDLE_PULSE_DURATION,
} from '../config';

export interface QueuedBubble {
  color: BubbleColor;
  type: BubbleType;
}

export class Shooter extends Phaser.Events.EventEmitter {
  private cradleSprite!: Phaser.GameObjects.Image;
  private currentSprite!: Phaser.GameObjects.Image;
  private nextSprite!: Phaser.GameObjects.Image;
  private aimAngle = 0;
  private cooldown = false;

  current!: QueuedBubble;
  next!: QueuedBubble;

  constructor(
    private scene: Phaser.Scene,
    private availableColors: BubbleColor[],
    private specialTypes: BubbleType[] = [],
    private specialChance = 0,
  ) {
    super();
    this.current = this.randomBubble();
    this.next = this.randomBubble();
    this.createSprites();
  }

  private createSprites(): void {
    this.cradleSprite = this.scene.add.image(
      SHOOTER_X,
      SHOOTER_Y - BUBBLE_RADIUS * 1.5,
      getShooterCradleTextureKey(),
    );
    this.currentSprite = this.scene.add.image(
      SHOOTER_X,
      SHOOTER_Y - BUBBLE_RADIUS * 1.5,
      getBubbleTextureKey(this.current.color, this.current.type),
    );
    this.scene.tweens.add({
      targets: this.currentSprite,
      scaleX: BUBBLE_IDLE_PULSE_SCALE,
      scaleY: BUBBLE_IDLE_PULSE_SCALE,
      duration: BUBBLE_IDLE_PULSE_DURATION / 2,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.nextSprite = this.scene.add.image(
      SHOOTER_X + 52,
      SHOOTER_Y + 10,
      getBubbleTextureKey(this.next.color, this.next.type),
    ).setScale(0.75).setInteractive({ useHandCursor: true });
    this.nextSprite.on('pointerdown', () => this.swapBubbles());
    this.scene.add.text(SHOOTER_X + 52, SHOOTER_Y + 28, 'NEXT', {
      fontSize: '10px',
      color: '#8892b0',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
  }

  setAimAngle(angle: number): void {
    const halfPi = Math.PI / 2;
    this.aimAngle = Phaser.Math.Clamp(
      angle,
      -(halfPi - MIN_SHOOT_ANGLE),
      halfPi - MIN_SHOOT_ANGLE,
    );
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

    this.emit('fire', this.current.color, this.aimAngle, this.current.type);

    this.current = this.next;
    this.next = this.randomBubble();
    this.refreshBubbleTextures();

    this.scene.time.delayedCall(SHOOT_COOLDOWN, () => {
      this.cooldown = false;
    });
  }

  swapBubbles(): void {
    if (this.cooldown) return;

    [this.current, this.next] = [this.next, this.current];
    this.refreshBubbleTextures();
  }

  private refreshBubbleTextures(): void {
    this.currentSprite.setTexture(
      getBubbleTextureKey(this.current.color, this.current.type),
    );
    this.nextSprite.setTexture(
      getBubbleTextureKey(this.next.color, this.next.type),
    );
  }

  private randomBubble(): QueuedBubble {
    const color = this.availableColors[Math.floor(Math.random() * this.availableColors.length)];
    if (this.specialTypes.length > 0 && Math.random() < this.specialChance) {
      const type = this.specialTypes[Math.floor(Math.random() * this.specialTypes.length)];
      return { color, type };
    }
    return { color, type: 'NORMAL' };
  }

  destroy(): void {
    this.cradleSprite.destroy();
    this.currentSprite.destroy();
    this.nextSprite.destroy();
    this.removeAllListeners();
  }
}

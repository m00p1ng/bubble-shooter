import Phaser from 'phaser';
import {
  GAME_WIDTH,
  BUBBLE_RADIUS,
  SHOOTER_X,
  SHOOTER_Y,
  GRID_ORIGIN_Y,
  MAX_TRAJECTORY_BOUNCES,
  MIN_SHOOT_ANGLE,
  AIM_ASSIST_EXTRA_BOUNCES,
} from '../config';

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export class Trajectory {
  private graphics: Phaser.GameObjects.Graphics;
  private aimAssist = false;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
  }

  setAimAssist(enabled: boolean): void {
    this.aimAssist = enabled;
  }

  update(aimAngle: number): void {
    this.graphics.clear();

    const halfPi = Math.PI / 2;
    const clampedAngle = Phaser.Math.Clamp(
      aimAngle,
      -(halfPi - MIN_SHOOT_ANGLE),
      halfPi - MIN_SHOOT_ANGLE,
    );

    const segments = this.computeSegments(clampedAngle);
    this.drawSegments(segments);
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private computeSegments(angle: number): Segment[] {
    const maxBounces = this.aimAssist
      ? MAX_TRAJECTORY_BOUNCES + AIM_ASSIST_EXTRA_BOUNCES
      : MAX_TRAJECTORY_BOUNCES;
    const segments: Segment[] = [];
    let x = SHOOTER_X;
    let y = SHOOTER_Y - BUBBLE_RADIUS - 4;
    let dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    const stopY = GRID_ORIGIN_Y + BUBBLE_RADIUS;

    for (let bounce = 0; bounce <= maxBounces; bounce++) {
      let tWall: number;
      let wallX: number;

      if (Math.abs(dx) < 0.0001) {
        tWall = Infinity;
        wallX = x;
      } else if (dx < 0) {
        tWall = (BUBBLE_RADIUS - x) / dx;
        wallX = BUBBLE_RADIUS;
      } else {
        tWall = (GAME_WIDTH - BUBBLE_RADIUS - x) / dx;
        wallX = GAME_WIDTH - BUBBLE_RADIUS;
      }

      const tTop = (stopY - y) / dy;

      if (tTop <= tWall) {
        segments.push({ x1: x, y1: y, x2: x + dx * tTop, y2: stopY });
        break;
      }

      segments.push({ x1: x, y1: y, x2: wallX, y2: y + dy * tWall });
      x = wallX;
      y += dy * tWall;
      dx = -dx;
    }

    return segments;
  }

  private drawSegments(segments: Segment[]): void {
    const dotSpacing = 12;
    const color = this.aimAssist ? 0x69f0ae : 0x00e5ff;
    const alpha = this.aimAssist ? 0.75 : 0.55;
    this.graphics.fillStyle(color, alpha);

    for (const segment of segments) {
      const totalLength = Math.hypot(
        segment.x2 - segment.x1,
        segment.y2 - segment.y1,
      );
      const ux = (segment.x2 - segment.x1) / totalLength;
      const uy = (segment.y2 - segment.y1) / totalLength;
      let traveled = 0;

      while (traveled < totalLength) {
        this.graphics.fillCircle(
          segment.x1 + ux * traveled,
          segment.y1 + uy * traveled,
          2,
        );
        traveled += dotSpacing;
      }
    }
  }
}

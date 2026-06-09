import Phaser from 'phaser';
import {
  GAME_WIDTH, BUBBLE_RADIUS, SHOOTER_X, SHOOTER_Y,
  GRID_ORIGIN_Y, MAX_TRAJECTORY_BOUNCES, MIN_SHOOT_ANGLE,
} from '../config';

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export class Trajectory {
  private graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
  }

  update(aimAngle: number): void {
    this.graphics.clear();

    const halfPi = Math.PI / 2;
    const clampedAngle = Phaser.Math.Clamp(aimAngle, -(halfPi - MIN_SHOOT_ANGLE), halfPi - MIN_SHOOT_ANGLE);

    const segments = this.computeSegments(clampedAngle);
    this.drawSegments(segments);
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private computeSegments(angle: number): Segment[] {
    const segments: Segment[] = [];
    let x = SHOOTER_X;
    let y = SHOOTER_Y - BUBBLE_RADIUS - 4;
    let dx = Math.sin(angle);
    let dy = -Math.cos(angle);
    const stopY = GRID_ORIGIN_Y + BUBBLE_RADIUS;

    for (let bounce = 0; bounce <= MAX_TRAJECTORY_BOUNCES; bounce++) {
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
      y = y + dy * tWall;
      dx = -dx;
    }

    return segments;
  }

  private drawSegments(segments: Segment[]): void {
    const DOT_SPACING = 12;
    this.graphics.fillStyle(0x00e5ff, 0.55);

    for (const seg of segments) {
      const totalLen = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
      const ux = (seg.x2 - seg.x1) / totalLen;
      const uy = (seg.y2 - seg.y1) / totalLen;
      let traveled = 0;

      while (traveled < totalLen) {
        const px = seg.x1 + ux * traveled;
        const py = seg.y1 + uy * traveled;
        this.graphics.fillCircle(px, py, 2);
        traveled += DOT_SPACING;
      }
    }
  }
}

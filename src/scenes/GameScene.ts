import Phaser from 'phaser';
import { Grid } from '../game/Grid';
import { getBubbleTextureKey } from '../game/Bubble';
import { gridToPixel, pixelToNearestGrid, getNeighbors } from '../utils/hexUtils';
import { Trajectory } from '../game/Trajectory';
import { Shooter } from '../game/Shooter';
import {
  GRID_COLS, GRID_ROWS, GAME_WIDTH, GAME_HEIGHT,
  SHOOTER_X, SHOOTER_Y, DANGER_LINE_Y,
  BUBBLE_SPEED, BUBBLE_RADIUS, GRID_ORIGIN_Y,
} from '../config';
import type { LevelData } from '../types/LevelData';
import type { BubbleColor } from '../game/Bubble';

type FlyingBubble = Phaser.GameObjects.Image & { vx: number; vy: number; bubbleColor: BubbleColor };

export class GameScene extends Phaser.Scene {
  private grid!: Grid;
  private gridSprites!: Map<string, Phaser.GameObjects.Image>;
  private levelData!: LevelData;
  private levelId!: number;
  private trajectory!: Trajectory;
  private shooter!: Shooter;
  private flyingBubbles: FlyingBubble[] = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.levelId = this.registry.get('currentLevel') as number;
    this.levelData = this.cache.json.get(`level-${this.levelId}`) as LevelData;

    this.grid = new Grid(GRID_ROWS, GRID_COLS);
    this.gridSprites = new Map();

    this.drawBackground();
    this.loadGridFromLevel();
    this.renderGrid();

    this.shooter = new Shooter(this, this.levelData.colors as BubbleColor[]);
    this.shooter.on('fire', this.onShooterFire, this);

    this.trajectory = new Trajectory(this);

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const dx = p.x - SHOOTER_X;
      const dy = SHOOTER_Y - p.y;
      if (dy <= 0) return;
      const angle = Math.atan2(dx, dy);
      this.shooter.setAimAngle(angle);
      this.trajectory.update(angle);
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const dy = SHOOTER_Y - p.y;
      if (dy <= 0) return;
      const dx = p.x - SHOOTER_X;
      const angle = Math.atan2(dx, dy);
      this.shooter.setAimAngle(angle);
      this.shooter.fire();
    });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    for (let i = this.flyingBubbles.length - 1; i >= 0; i--) {
      const b = this.flyingBubbles[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x < BUBBLE_RADIUS) {
        b.x = BUBBLE_RADIUS;
        b.vx = Math.abs(b.vx);
      } else if (b.x > GAME_WIDTH - BUBBLE_RADIUS) {
        b.x = GAME_WIDTH - BUBBLE_RADIUS;
        b.vx = -Math.abs(b.vx);
      }

      const snapCell = this.findSnapCell(b.x, b.y);
      if (snapCell) {
        this.flyingBubbles.splice(i, 1);
        this.placeBubble(b.bubbleColor, snapCell.row, snapCell.col);
        b.destroy();
      }
    }
  }

  private drawBackground(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x050510);

    const line = this.add.graphics();
    line.lineStyle(1, 0xff4081, 0.3);
    line.lineBetween(0, DANGER_LINE_Y, GAME_WIDTH, DANGER_LINE_Y);
  }

  private loadGridFromLevel(): void {
    this.grid.loadFromData(this.levelData.grid as (BubbleColor | null)[][]);
  }

  renderGrid(): void {
    this.gridSprites.forEach((s) => s.destroy());
    this.gridSprites.clear();

    for (let r = 0; r < this.grid.rows; r++) {
      for (let c = 0; c < this.grid.getColsForRow(r); c++) {
        const cell = this.grid.getCell(r, c);
        if (!cell?.color) continue;
        const { x, y } = gridToPixel(r, c);
        const sprite = this.add.image(x, y, getBubbleTextureKey(cell.color));
        this.gridSprites.set(`${r},${c}`, sprite);
      }
    }
  }

  private onShooterFire(color: BubbleColor, angle: number): void {
    const vx = Math.sin(angle) * BUBBLE_SPEED;
    const vy = -Math.cos(angle) * BUBBLE_SPEED;
    const bubble = this.add.image(SHOOTER_X, SHOOTER_Y - BUBBLE_RADIUS * 1.5, getBubbleTextureKey(color)) as FlyingBubble;
    bubble.vx = vx;
    bubble.vy = vy;
    bubble.bubbleColor = color;
    this.flyingBubbles.push(bubble);
  }

  private findSnapCell(bx: number, by: number): { row: number; col: number } | null {
    const stopY = GRID_ORIGIN_Y + BUBBLE_RADIUS;

    for (let r = 0; r < this.grid.rows; r++) {
      for (let c = 0; c < this.grid.getColsForRow(r); c++) {
        if (!this.grid.getCell(r, c)?.color) continue;
        const pos = gridToPixel(r, c);
        if (Math.hypot(bx - pos.x, by - pos.y) < BUBBLE_RADIUS * 2) {
          return this.nearestEmptyAround(bx, by, r, c);
        }
      }
    }

    if (by <= stopY) {
      return this.nearestEmptyAt(pixelToNearestGrid(bx, by));
    }

    return null;
  }

  private nearestEmptyAround(
    bx: number, by: number,
    hitRow: number, hitCol: number,
  ): { row: number; col: number } | null {
    const candidates = [
      { row: hitRow, col: hitCol },
      ...getNeighbors(hitRow, hitCol),
    ];
    let best: { row: number; col: number } | null = null;
    let bestDist = Infinity;
    for (const cand of candidates) {
      const cell = this.grid.getCell(cand.row, cand.col);
      if (cell && !cell.color) {
        const pos = gridToPixel(cand.row, cand.col);
        const dist = Math.hypot(bx - pos.x, by - pos.y);
        if (dist < bestDist) { bestDist = dist; best = cand; }
      }
    }
    return best;
  }

  private nearestEmptyAt(pos: { row: number; col: number }): { row: number; col: number } | null {
    const cell = this.grid.getCell(pos.row, pos.col);
    if (cell && !cell.color) return pos;
    for (const n of getNeighbors(pos.row, pos.col)) {
      const nc = this.grid.getCell(n.row, n.col);
      if (nc && !nc.color) return n;
    }
    return null;
  }

  private placeBubble(color: BubbleColor, row: number, col: number): void {
    this.grid.setCell(row, col, color);
    const { x, y } = gridToPixel(row, col);
    const sprite = this.add.image(x, y, getBubbleTextureKey(color));
    this.gridSprites.set(`${row},${col}`, sprite);

    this.tweens.add({ targets: sprite, scaleX: 1.2, scaleY: 1.2, duration: 60, yoyo: true });

    this.processMatch(row, col);
  }

  private processMatch(_row: number, _col: number): void {
    // TODO — implemented in Task 10
  }
}

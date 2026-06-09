import Phaser from 'phaser';
import { Grid } from '../game/Grid';
import { getBubbleTextureKey, getShooterTextureKey } from '../game/Bubble';
import { gridToPixel } from '../utils/hexUtils';
import { Trajectory } from '../game/Trajectory';
import {
  GRID_COLS, GRID_ROWS, GAME_WIDTH, GAME_HEIGHT,
  SHOOTER_X, SHOOTER_Y, DANGER_LINE_Y,
} from '../config';
import type { LevelData } from '../types/LevelData';
import type { BubbleColor } from '../game/Bubble';

export class GameScene extends Phaser.Scene {
  private grid!: Grid;
  private gridSprites!: Map<string, Phaser.GameObjects.Image>;
  private levelData!: LevelData;
  private levelId!: number;
  private trajectory!: Trajectory;

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
    this.drawShooter();

    this.trajectory = new Trajectory(this);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const dx = p.x - SHOOTER_X;
      const dy = SHOOTER_Y - p.y;
      if (dy <= 0) return;
      const angle = Math.atan2(dx, dy);
      this.trajectory.update(angle);
    });
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

  private drawShooter(): void {
    this.add.image(SHOOTER_X, SHOOTER_Y, getShooterTextureKey()).setAngle(180);
  }
}

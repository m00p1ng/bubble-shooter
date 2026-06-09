import Phaser from 'phaser';
import { Grid } from '../game/Grid';
import { getBubbleTextureKey } from '../game/Bubble';
import { gridToPixel, pixelToNearestGrid, getNeighbors } from '../utils/hexUtils';
import { Trajectory } from '../game/Trajectory';
import { Shooter } from '../game/Shooter';
import { saveLevelResult } from '../utils/storage';
import {
  GRID_COLS, GRID_ROWS, GAME_WIDTH, GAME_HEIGHT,
  SHOOTER_X, SHOOTER_Y, DANGER_LINE_Y,
  BUBBLE_SPEED, BUBBLE_RADIUS, GRID_ORIGIN_Y,
  MATCH_MIN, SCORE_PER_POP, SCORE_PER_ORPHAN,
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
  private score = 0;
  private totalBubbles = 0;
  private movesLeft = 0;
  private gameOver = false;

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

    this.totalBubbles = this.grid.countBubbles();
    this.movesLeft = this.levelData.moves ?? 30;
    this.score = 0;
    this.gameOver = false;

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
      if (this.gameOver) return;
      const dy = SHOOTER_Y - p.y;
      if (dy <= 0) return;
      const dx = p.x - SHOOTER_X;
      const angle = Math.atan2(dx, dy);
      this.shooter.setAimAngle(angle);
      this.shooter.fire();
    });

    this.scene.launch('UIScene');
    this.time.delayedCall(50, () => {
      this.events.emit('moves-update', this.movesLeft);
      this.events.emit('progress-update', this.grid.countBubbles(), this.totalBubbles);
    });

    this.events.on('shutdown', this.shutdown, this);
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

  private processMatch(row: number, col: number): void {
    const matched = this.grid.findMatch(row, col);
    if (matched.length < MATCH_MIN) {
      this.advanceTurn();
      return;
    }

    const popX = matched.reduce((s, c) => s + gridToPixel(c.row, c.col).x, 0) / matched.length;
    const popY = matched.reduce((s, c) => s + gridToPixel(c.row, c.col).y, 0) / matched.length;

    matched.forEach(({ row: r, col: c }) => {
      this.removeCellSprite(r, c);
      this.grid.setCell(r, c, null);
    });
    this.score += matched.length * SCORE_PER_POP;

    this.events.emit('score-update', this.score);
    this.shakeCamera(matched.length);
    this.spawnScoreText(popX, popY, matched.length * SCORE_PER_POP);

    const orphans = this.grid.findOrphans();
    orphans.forEach(({ row: r, col: c }, idx) => {
      const { y } = gridToPixel(r, c);
      const sprite = this.gridSprites.get(`${r},${c}`);
      this.grid.setCell(r, c, null);
      this.gridSprites.delete(`${r},${c}`);
      if (sprite) {
        this.tweens.add({
          targets: sprite,
          y: y + 500,
          alpha: 0,
          angle: Phaser.Math.Between(-90, 90),
          duration: 500,
          delay: idx * 40,
          onComplete: () => sprite.destroy(),
        });
      }
    });
    this.score += orphans.length * SCORE_PER_ORPHAN;
    if (orphans.length > 0) this.events.emit('score-update', this.score);

    this.events.emit('progress-update', this.grid.countBubbles(), this.totalBubbles);

    this.advanceTurn();
  }

  private removeCellSprite(row: number, col: number): void {
    const sprite = this.gridSprites.get(`${row},${col}`);
    if (!sprite) return;
    this.gridSprites.delete(`${row},${col}`);
    sprite.destroy();
  }

  private shakeCamera(matchCount: number): void {
    this.cameras.main.shake(150, 0.005 * matchCount);
  }

  private spawnScoreText(x: number, y: number, points: number): void {
    const txt = this.add.text(x, y, `+${points}`, {
      fontSize: '18px',
      color: '#fff176',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.tweens.add({
      targets: txt,
      y: y - 60,
      alpha: 0,
      duration: 600,
      onComplete: () => txt.destroy(),
    });
  }

  private advanceTurn(): void {
    if (this.gameOver) return;
    this.movesLeft--;
    this.events.emit('moves-update', this.movesLeft);

    if (this.grid.isEmpty()) {
      this.triggerWin();
    } else if (this.movesLeft <= 0) {
      this.triggerLose('no_moves');
    }
  }

  private triggerWin(): void {
    this.gameOver = true;
    const stars = this.calcStars();
    saveLevelResult(this.levelId, stars, this.score);
    this.events.emit('game-over', true, this.score, stars);
    this.showResultOverlay(true, stars);
  }

  private triggerLose(reason: string): void {
    console.log('lose:', reason);
    this.gameOver = true;
    saveLevelResult(this.levelId, 0, this.score);
    this.events.emit('game-over', false, this.score, 0);
    this.showResultOverlay(false, 0);
  }

  private calcStars(): number {
    const [s1, s2, s3] = this.levelData.stars;
    if (this.score >= s3) return 3;
    if (this.score >= s2) return 2;
    if (this.score >= s1) return 1;
    return 0;
  }

  private showResultOverlay(won: boolean, stars: number): void {
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75);
    overlay.setDepth(10);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80,
      won ? 'MISSION COMPLETE' : 'MISSION FAILED',
      { fontSize: '28px', color: won ? '#00e5ff' : '#ff4081', fontFamily: 'monospace', fontStyle: 'bold' },
    ).setOrigin(0.5).setDepth(11);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30,
      `SCORE: ${this.score}`,
      { fontSize: '20px', color: '#c0c8ff', fontFamily: 'monospace' },
    ).setOrigin(0.5).setDepth(11);

    if (won) {
      const starsText = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20,
        starsText,
        { fontSize: '36px', color: '#ffd600' },
      ).setOrigin(0.5).setDepth(11);
    }

    const nextId = this.levelId < 3 ? this.levelId + 1 : null;
    const btnLabel = won && nextId ? 'NEXT MISSION' : 'RETRY';
    const btn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 90,
      `[ ${btnLabel} ]`,
      { fontSize: '20px', color: '#69f0ae', fontFamily: 'monospace' },
    ).setOrigin(0.5).setDepth(11).setInteractive({ useHandCursor: true });

    btn.on('pointerdown', () => {
      if (won && nextId) {
        this.registry.set('currentLevel', nextId);
      }
      this.scene.restart();
    });
  }

  shutdown(): void {
    this.scene.stop('UIScene');
  }
}

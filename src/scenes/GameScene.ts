import Phaser from 'phaser';
import { Grid } from '../game/Grid';
import { getBubbleTextureKey } from '../game/Bubble';
import {
  gridToPixel,
  pixelToNearestGrid,
  getNeighbors,
  isGridCellPastDangerLine,
} from '../utils/hexUtils';
import { Trajectory } from '../game/Trajectory';
import { Shooter } from '../game/Shooter';
import { saveLevelResult } from '../utils/storage';
import { Effects } from '../game/Effects';
import { AudioManager } from '../audio/AudioManager';
import { normalizePointer, isMobile, getTouchScaleFactor } from '../utils/mobile';
import { createStarfield } from '../utils/starfield';
import {
  GRID_COLS, GRID_ROWS, GAME_WIDTH, GAME_HEIGHT,
  SHOOTER_X, SHOOTER_Y, DANGER_LINE_Y,
  BUBBLE_SPEED, BUBBLE_RADIUS, GRID_ORIGIN_Y,
  MATCH_MIN, SCORE_PER_POP, SCORE_PER_ORPHAN,
  BUBBLE_IDLE_PULSE_SCALE, BUBBLE_IDLE_PULSE_DURATION, BUBBLE_IDLE_PULSE_DELAY_VARIANCE,
  BOMB_RADIUS, COLOR_BOMB_SCORE,
} from '../config';
import type { LevelData } from '../types/LevelData';
import type { BubbleColor, BubbleType } from '../game/Bubble';

type FlyingBubble = Phaser.GameObjects.Image & {
  vx: number;
  vy: number;
  bubbleColor: BubbleColor;
  bubbleType: BubbleType;
};
type SnapResult = { row: number; col: number } | 'overflow' | null;

export class GameScene extends Phaser.Scene {
  private grid!: Grid;
  private gridSprites!: Map<string, Phaser.GameObjects.Image>;
  private levelData!: LevelData;
  private levelId!: number;
  private trajectory!: Trajectory;
  private shooter!: Shooter;
  private flyingBubbles: FlyingBubble[] = [];
  private effects!: Effects;
  private score = 0;
  private totalBubbles = 0;
  private movesLeft = 0;
  private timeLeft = 0;
  private timerEvent: Phaser.Time.TimerEvent | null = null;
  private gameOver = false;
  private aimAssistActive = false;
  private colorBombPending = false;

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

    this.effects = new Effects(this);
    AudioManager.getInstance().startMusic('game');
    this.totalBubbles = this.grid.countBubbles();
    this.score = 0;
    this.gameOver = false;
    this.aimAssistActive = false;
    this.colorBombPending = false;

    if (this.levelData.type === 'timer') {
      this.timeLeft = this.levelData.time ?? 60;
      this.movesLeft = 0;
      this.timerEvent = this.time.addEvent({
        delay: 1000,
        callback: this.onTimerTick,
        callbackScope: this,
        loop: true,
      });
    } else {
      this.movesLeft = this.levelData.moves ?? 30;
    }

    const specialTypes: BubbleType[] = [];
    if (this.levelData.specialBubbles?.stone) specialTypes.push('STONE');
    if (this.levelData.specialBubbles?.bomb) specialTypes.push('BOMB');
    if (this.levelData.specialBubbles?.wildcard) specialTypes.push('WILDCARD');
    const specialChance = this.levelData.shooterSpecialChance ?? 0;
    this.shooter = new Shooter(
      this,
      () => {
        const active = this.grid.getActiveColors();
        return active.length > 0 ? active : this.levelData.colors;
      },
      specialTypes,
      specialChance,
    );
    this.shooter.on('fire', this.onShooterFire, this);

    this.trajectory = new Trajectory(this);
    this.events.on('activate-aim-assist', this.activateAimAssist, this);
    this.events.on('activate-color-bomb', this.activateColorBomb, this);

    const updateAim = (x: number, y: number) => {
      const dx = x - SHOOTER_X;
      const dy = SHOOTER_Y - y;
      if (dy <= 0) return;
      const angle = Math.atan2(dx, dy);
      this.shooter.setAimAngle(angle);
      this.trajectory.update(angle);
    };

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      updateAim(p.x, p.y);
    });

    if (isMobile()) {
      this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
        updateAim(p.x, p.y);
      });

      this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (this.gameOver || this.colorBombPending) return;
        const normalized = normalizePointer(p);
        if (!normalized.isTap) return;
        const dy = SHOOTER_Y - normalized.y;
        if (dy <= 0) return;
        this.shooter.fire();
      });
    } else {
      this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (this.gameOver || this.colorBombPending) return;
        const normalized = normalizePointer(p);
        if (!normalized.isTap) return;
        const dy = SHOOTER_Y - normalized.y;
        if (dy <= 0) return;
        const dx = normalized.x - SHOOTER_X;
        const angle = Math.atan2(dx, dy);
        this.shooter.setAimAngle(angle);
        this.shooter.fire();
      });
    }

    this.scene.launch('UIScene');
    this.time.delayedCall(50, () => {
      if (this.levelData.type === 'timer') {
        this.events.emit('timer-update', this.timeLeft);
      } else {
        this.events.emit('moves-update', this.movesLeft);
      }
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
      if (snapCell === 'overflow') {
        this.flyingBubbles.splice(i, 1);
        b.destroy();
        this.triggerLose('overflow');
      } else if (snapCell) {
        this.flyingBubbles.splice(i, 1);
        this.placeBubble(b.bubbleColor, snapCell.row, snapCell.col, b.bubbleType);
        b.destroy();
      } else if (b.y <= BUBBLE_RADIUS) {
        this.flyingBubbles.splice(i, 1);
        b.destroy();
        this.triggerLose('overflow');
      }
    }
  }

  private drawBackground(): void {
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x050510)
      .setDepth(-10);
    createStarfield(this);

    const line = this.add.graphics();
    line.lineStyle(1, 0xff4081, 0.3);
    line.lineBetween(0, DANGER_LINE_Y, GAME_WIDTH, DANGER_LINE_Y);
  }

  private activateAimAssist(): void {
    this.aimAssistActive = true;
    this.trajectory.setAimAssist(true);
  }

  private activateColorBomb(): void {
    if (this.gameOver || this.colorBombPending) return;
    this.colorBombPending = true;
    this.showColorPicker();
  }

  private showColorPicker(): void {
    const colors = this.levelData.colors;
    const buttonY = GAME_HEIGHT / 2;
    const startX = GAME_WIDTH / 2 - ((colors.length - 1) * 50) / 2;
    const overlay = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x000000,
      0.6,
    ).setDepth(20);
    const label = this.add.text(
      GAME_WIDTH / 2,
      buttonY - 60,
      'PICK COLOR TO CLEAR',
      {
        fontSize: '18px',
        color: '#ff4081',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      },
    ).setOrigin(0.5).setDepth(21);
    const buttons: Phaser.GameObjects.Image[] = [];

    colors.forEach((color, index) => {
      const button = this.add.image(
        startX + index * 50,
        buttonY,
        getBubbleTextureKey(color),
      ).setInteractive({ useHandCursor: true }).setDepth(21);
      buttons.push(button);
      button.on('pointerdown', (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        overlay.destroy();
        label.destroy();
        buttons.forEach((item) => item.destroy());
        this.executeColorBomb(color);
      });
    });
  }

  private executeColorBomb(targetColor: BubbleColor): void {
    this.colorBombPending = false;
    let cleared = 0;

    for (let row = 0; row < this.grid.rows; row++) {
      for (let col = 0; col < this.grid.getColsForRow(row); col++) {
        const cell = this.grid.getCell(row, col);
        if (cell?.color === targetColor && cell.type === 'NORMAL') {
          this.removeCellSprite(row, col);
          this.grid.setCell(row, col, null);
          cleared++;
        }
      }
    }

    if (cleared > 0) {
      this.score += cleared * COLOR_BOMB_SCORE;
      this.events.emit('score-update', this.score);
      this.effects.shakeCamera(cleared);
      AudioManager.getInstance().playPop();
    }

    const orphans = this.grid.findOrphans();
    orphans.forEach(({ row, col }, index) => {
      const { y } = gridToPixel(row, col);
      const sprite = this.gridSprites.get(`${row},${col}`);
      this.grid.setCell(row, col, null);
      this.gridSprites.delete(`${row},${col}`);
      if (sprite) {
        this.tweens.add({
          targets: sprite,
          y: y + 500,
          alpha: 0,
          angle: Phaser.Math.Between(-90, 90),
          duration: 500,
          delay: index * 40,
          onComplete: () => sprite.destroy(),
        });
      }
    });

    this.score += orphans.length * SCORE_PER_ORPHAN;
    if (orphans.length > 0) this.events.emit('score-update', this.score);
    this.events.emit('progress-update', this.grid.countBubbles(), this.totalBubbles);
    this.advanceTurn();
  }

  private loadGridFromLevel(): void {
    this.grid.loadFromData(this.levelData.grid);
  }

  renderGrid(): void {
    this.gridSprites.forEach((s) => s.destroy());
    this.gridSprites.clear();

    for (let r = 0; r < this.grid.rows; r++) {
      for (let c = 0; c < this.grid.getColsForRow(r); c++) {
        const cell = this.grid.getCell(r, c);
        if (!cell?.color) continue;
        const { x, y } = gridToPixel(r, c);
        const sprite = this.add.image(x, y, getBubbleTextureKey(cell.color, cell.type));
        this.gridSprites.set(`${r},${c}`, sprite);
        this.addIdleAnimation(sprite);
        if (isMobile()) {
          sprite.setInteractive(new Phaser.Geom.Circle(0, 0, BUBBLE_RADIUS * getTouchScaleFactor()), Phaser.Geom.Circle.Contains);
        }
      }
    }
  }

  private addIdleAnimation(sprite: Phaser.GameObjects.Image): void {
    const delay = Phaser.Math.Between(0, BUBBLE_IDLE_PULSE_DELAY_VARIANCE);
    this.tweens.add({
      targets: sprite,
      scaleX: BUBBLE_IDLE_PULSE_SCALE,
      scaleY: BUBBLE_IDLE_PULSE_SCALE,
      duration: BUBBLE_IDLE_PULSE_DURATION / 2,
      delay,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private onShooterFire(
    color: BubbleColor,
    angle: number,
    type: BubbleType = 'NORMAL',
  ): void {
    const vx = Math.sin(angle) * BUBBLE_SPEED;
    const vy = -Math.cos(angle) * BUBBLE_SPEED;
    const bubble = this.add.image(
      SHOOTER_X,
      SHOOTER_Y - BUBBLE_RADIUS * 1.5,
      getBubbleTextureKey(color, type),
    ) as FlyingBubble;
    bubble.vx = vx;
    bubble.vy = vy;
    bubble.bubbleColor = color;
    bubble.bubbleType = type;
    this.flyingBubbles.push(bubble);
    AudioManager.getInstance().playShoot();
  }

  private findSnapCell(bx: number, by: number): SnapResult {
    const stopY = GRID_ORIGIN_Y + BUBBLE_RADIUS;
    const contacts: Array<{ row: number; col: number }> = [];

    for (let r = 0; r < this.grid.rows; r++) {
      for (let c = 0; c < this.grid.getColsForRow(r); c++) {
        if (!this.grid.getCell(r, c)?.color) continue;
        const pos = gridToPixel(r, c);
        if (Math.hypot(bx - pos.x, by - pos.y) < BUBBLE_RADIUS * 2) {
          contacts.push({ row: r, col: c });
        }
      }
    }

    if (contacts.length > 0) {
      const localCell = this.nearestEmptyAroundContacts(bx, by, contacts);
      if (localCell) {
        return isGridCellPastDangerLine(localCell.row, localCell.col)
          ? 'overflow'
          : localCell;
      }

      if (contacts.some(({ row }) => row === this.grid.rows - 1)) {
        return 'overflow';
      }

      const fallbackCell = this.grid.findNearestEmpty(contacts);
      if (!fallbackCell || isGridCellPastDangerLine(fallbackCell.row, fallbackCell.col)) {
        return 'overflow';
      }
      return fallbackCell;
    }

    if (by <= stopY) {
      const snapCell = this.nearestEmptyAt(pixelToNearestGrid(bx, by));
      if (!snapCell || isGridCellPastDangerLine(snapCell.row, snapCell.col)) {
        return 'overflow';
      }
      return snapCell;
    }

    return null;
  }

  private nearestEmptyAroundContacts(
    bx: number, by: number,
    contacts: Array<{ row: number; col: number }>,
  ): { row: number; col: number } | null {
    const candidates = this.grid.findEmptyNeighbors(contacts);
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

  private placeBubble(
    color: BubbleColor,
    row: number,
    col: number,
    type: BubbleType = 'NORMAL',
  ): void {
    this.grid.setCell(row, col, color, type);
    const { x, y } = gridToPixel(row, col);
    const sprite = this.add.image(x, y, getBubbleTextureKey(color, type));
    this.gridSprites.set(`${row},${col}`, sprite);
    this.addIdleAnimation(sprite);

    this.tweens.add({ targets: sprite, scaleX: 1.2, scaleY: 1.2, duration: 60, yoyo: true });

    this.processMatch(row, col);
  }

  private processMatch(row: number, col: number): void {
    const cell = this.grid.getCell(row, col);
    if (!cell?.color) {
      this.advanceTurn();
      return;
    }

    let matched: Array<{ row: number; col: number }>;
    if (cell.type === 'BOMB') {
      matched = this.grid.getCellsInRadius(row, col, BOMB_RADIUS);
    } else if (cell.type === 'WILDCARD') {
      matched = this.grid.findBestWildcardMatch(row, col);
    } else {
      matched = this.grid.findMatch(row, col);
    }

    if (matched.length < MATCH_MIN && cell.type !== 'BOMB') {
      this.advanceTurn();
      return;
    }

    const popX = matched.reduce((s, c) => s + gridToPixel(c.row, c.col).x, 0) / matched.length;
    const popY = matched.reduce((s, c) => s + gridToPixel(c.row, c.col).y, 0) / matched.length;

    let poppedCount = 0;
    matched.forEach(({ row: r, col: c }) => {
      const targetCell = this.grid.getCell(r, c);
      if (!targetCell?.color) return;

      if (targetCell.type === 'STONE') {
        this.grid.damageCell(r, c);
        if (this.grid.getCell(r, c)?.color) {
          const sprite = this.gridSprites.get(`${r},${c}`);
          if (sprite) {
            this.tweens.add({
              targets: sprite,
              alpha: 0.4,
              duration: 80,
              yoyo: true,
            });
          }
        } else {
          this.removeCellSprite(r, c, targetCell.color);
          poppedCount++;
        }
        return;
      }

      this.removeCellSprite(r, c);
      this.grid.setCell(r, c, null);
      poppedCount++;
    });

    this.score += poppedCount * SCORE_PER_POP;
    if (poppedCount > 0) {
      AudioManager.getInstance().playPop();
      this.events.emit('score-update', this.score);
      this.effects.shakeCamera(poppedCount);
      this.spawnScoreText(popX, popY, poppedCount * SCORE_PER_POP);
    }

    const orphans = this.grid.findOrphans();
    orphans.forEach(({ row: r, col: c }, idx) => {
      const { y } = gridToPixel(r, c);
      const sprite = this.gridSprites.get(`${r},${c}`);
      this.grid.setCell(r, c, null);
      this.gridSprites.delete(`${r},${c}`);
      AudioManager.getInstance().playOrphanDrop();
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

  private removeCellSprite(
    row: number,
    col: number,
    effectColor?: BubbleColor,
  ): void {
    const sprite = this.gridSprites.get(`${row},${col}`);
    if (!sprite) return;
    this.gridSprites.delete(`${row},${col}`);
    const cell = this.grid.getCell(row, col);
    const color = effectColor ?? cell?.color;
    if (color) this.effects.popBurst(sprite.x, sprite.y, color);
    sprite.destroy();
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

    if (this.levelData.type === 'moves') {
      this.movesLeft--;
      this.events.emit('moves-update', this.movesLeft);

      if (this.grid.isEmpty()) {
        this.triggerWin();
      } else if (this.movesLeft <= 0) {
        this.triggerLose('no_moves');
      }
    } else {
      if (this.grid.isEmpty()) {
        this.triggerWin();
      }
    }
  }

  private onTimerTick(): void {
    if (this.gameOver) return;
    this.timeLeft--;
    this.events.emit('timer-update', this.timeLeft);
    if (this.timeLeft <= 0) {
      this.triggerLose('timeout');
    }
  }

  private triggerWin(): void {
    this.gameOver = true;
    AudioManager.getInstance().playWin();
    const stars = this.calcStars();
    saveLevelResult(this.levelId, stars, this.score);
    this.events.emit('game-over', true, this.score, stars);
    this.showResultOverlay(true, stars);
  }

  private triggerLose(reason: string): void {
    console.log('lose:', reason);
    this.gameOver = true;
    AudioManager.getInstance().playLose();
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

    const mapBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 80, '[ MAP ]', {
      fontSize: '18px', color: '#c0c8ff', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(11).setInteractive({ useHandCursor: true });

    mapBtn.on('pointerdown', () => {
      import('../utils/transition').then(({ fadeOutAndStart }) => {
        fadeOutAndStart(this, 'MapScene', { stopScenes: ['UIScene'] });
      });
    });

    const hasNext = won && this.levelId < 10;
    const actionLabel = hasNext ? '[ NEXT MISSION ]' : '[ RETRY ]';
    const actionBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 120, actionLabel, {
      fontSize: '18px', color: '#69f0ae', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(11).setInteractive({ useHandCursor: true });

    actionBtn.on('pointerdown', () => {
      if (hasNext) {
        this.registry.set('currentLevel', this.levelId + 1);
      }
      import('../utils/transition').then(({ fadeOutAndStart }) => {
        fadeOutAndStart(this, 'GameScene', { stopScenes: ['UIScene'] });
      });
    });
  }

  shutdown(): void {
    if (this.timerEvent) {
      this.timerEvent.remove();
      this.timerEvent = null;
    }
    this.events.off('activate-aim-assist', this.activateAimAssist, this);
    this.events.off('activate-color-bomb', this.activateColorBomb, this);
    AudioManager.getInstance().stopMusic();
    this.scene.stop('UIScene');
  }
}

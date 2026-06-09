# Phase 4 — Special Bubbles & Power-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add stone, bomb, and wildcard bubble types plus aim-assist and color-bomb power-ups, with per-level JSON configuration.

**Architecture:** Extend `GridCell` with `type` and `hitPoints`. Special bubbles are parsed from level JSON (backward-compatible string format preserved). Bombs use hex-distance radius pop. Wildcards dynamically pick the best neighbor color at snap time. Power-ups are one-shot abilities triggered from HUD buttons. All new grid logic is unit-tested; Phaser-dependent code is minimal and isolated.

**Tech Stack:** TypeScript, Phaser 3, Vite, Vitest

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/game/Bubble.ts` | `BubbleType`, `GridCell`, `DEFAULT_HIT_POINTS`, texture keys, grid-cell parser |
| `src/game/Grid.ts` | Hex grid state, `findMatch` (wildcard-aware, stone-excluding), `getCellsInRadius`, `damageCell` |
| `src/game/Shooter.ts` | Queue tracks `(color, type)` pairs; emits both on fire |
| `src/game/Trajectory.ts` | Aim-assist mode extends bounce count and preview length |
| `src/scenes/GameScene.ts` | Snap → match/orphan logic extended for stone damage, bomb explosion, wildcard resolution, power-up handling |
| `src/scenes/UIScene.ts` | Power-up buttons (aim assist, color bomb), emit activation events |
| `src/scenes/BootScene.ts` | Procedural textures for stone, bomb, wildcard variants |
| `src/types/LevelData.ts` | `GridCellData` union type, `specialBubbles` + `shooterSpecialChance` fields |
| `tests/GridSpecial.test.ts` | Tests for stone, bomb radius, wildcard match logic |
| `tests/BubbleParser.test.ts` | Tests for `parseGridCellData` backward compatibility |
| `src/data/levels/level-004.json` | Example level with special bubbles on grid |

---

## Constants to Add (`src/config.ts`)

Add these to the bottom of `src/config.ts` (after line 49):

```typescript
// Special bubbles
export const STONE_HIT_POINTS = 2;
export const BOMB_RADIUS = 2; // hex rings

// Power-ups
export const AIM_ASSIST_EXTRA_BOUNCES = 3;
export const COLOR_BOMB_SCORE = 50; // per bubble cleared

// Shooter special bubble chance (0–1)
export const DEFAULT_SHOOTER_SPECIAL_CHANCE = 0.15;
```

---

## Task 1: Extend Bubble Type System

**Files:**
- Modify: `src/game/Bubble.ts`
- Modify: `src/types/LevelData.ts`
- Test: `tests/BubbleParser.test.ts`

### Step 1: Write the failing test

Create `tests/BubbleParser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseGridCellData, ALL_COLORS, type BubbleType } from '../src/game/Bubble';

describe('parseGridCellData', () => {
  it('parses null as null', () => {
    expect(parseGridCellData(null)).toBeNull();
  });

  it('parses string color as NORMAL type', () => {
    const result = parseGridCellData('RED');
    expect(result).toEqual({ color: 'RED', type: 'NORMAL', hitPoints: 1 });
  });

  it('parses STONE object', () => {
    const result = parseGridCellData({ type: 'STONE', color: 'BLUE' });
    expect(result).toEqual({ color: 'BLUE', type: 'STONE', hitPoints: 2 });
  });

  it('parses BOMB object with default color RED', () => {
    const result = parseGridCellData({ type: 'BOMB' });
    expect(result).toEqual({ color: 'RED', type: 'BOMB', hitPoints: 1 });
  });

  it('parses WILDCARD object', () => {
    const result = parseGridCellData({ type: 'WILDCARD' });
    expect(result).toEqual({ color: 'RED', type: 'WILDCARD', hitPoints: 1 });
  });

  it('throws on unknown string', () => {
    expect(() => parseGridCellData('PINK')).toThrow('Unknown bubble color');
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- tests/BubbleParser.test.ts`
Expected: FAIL — `parseGridCellData` and `BubbleType` not defined.

### Step 3: Write minimal implementation

Replace the entire contents of `src/game/Bubble.ts`:

```typescript
export type BubbleColor = 'RED' | 'BLUE' | 'GREEN' | 'YELLOW' | 'PURPLE' | 'CYAN';

export const ALL_COLORS: BubbleColor[] = ['RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE', 'CYAN'];

export type BubbleType = 'NORMAL' | 'STONE' | 'BOMB' | 'WILDCARD';

export const ALL_BUBBLE_TYPES: BubbleType[] = ['NORMAL', 'STONE', 'BOMB', 'WILDCARD'];

export interface BubbleColorConfig {
  base: string;
  glow: string;
}

export const COLOR_CONFIG: Record<BubbleColor, BubbleColorConfig> = {
  RED:    { base: '#ff6b6b', glow: '#ff4081' },
  BLUE:   { base: '#7986ff', glow: '#7c4dff' },
  CYAN:   { base: '#4dd0e1', glow: '#00e5ff' },
  GREEN:  { base: '#a5d6a7', glow: '#69f0ae' },
  YELLOW: { base: '#fff176', glow: '#ffd600' },
  PURPLE: { base: '#ce93d8', glow: '#aa00ff' },
};

export const DEFAULT_HIT_POINTS: Record<BubbleType, number> = {
  NORMAL: 1,
  STONE: 2,
  BOMB: 1,
  WILDCARD: 1,
};

export interface GridCell {
  color: BubbleColor | null;
  type: BubbleType;
  hitPoints: number;
}

export function getBubbleTextureKey(color: BubbleColor, type: BubbleType = 'NORMAL'): string {
  return type === 'NORMAL' ? `bubble_${color}` : `bubble_${type}_${color}`;
}

export function getShooterTextureKey(): string {
  return 'shooter';
}

export type GridCellData = BubbleColor | { type: BubbleType; color?: BubbleColor } | null;

export function parseGridCellData(data: unknown): GridCell | null {
  if (data === null) return null;

  if (typeof data === 'string') {
    if (ALL_COLORS.includes(data as BubbleColor)) {
      return { color: data as BubbleColor, type: 'NORMAL', hitPoints: DEFAULT_HIT_POINTS['NORMAL'] };
    }
    throw new Error(`Unknown bubble color: ${data}`);
  }

  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    const type = (obj.type as BubbleType) ?? 'NORMAL';
    const color = (obj.color as BubbleColor | undefined) ?? 'RED';
    return { color, type, hitPoints: DEFAULT_HIT_POINTS[type] };
  }

  throw new Error(`Invalid grid cell data: ${data}`);
}
```

### Step 4: Update LevelData.ts

Replace `src/types/LevelData.ts`:

```typescript
import type { BubbleColor } from '../game/Bubble';
import type { GridCellData } from '../game/Bubble';

export interface LevelData {
  id: number;
  name: string;
  type: 'moves' | 'timer';
  moves?: number;
  time?: number;
  colors: BubbleColor[];
  grid: GridCellData[][];
  stars: [number, number, number];
  descentInterval: number;
  specialBubbles?: {
    stone?: boolean;
    bomb?: boolean;
    wildcard?: boolean;
  };
  shooterSpecialChance?: number;
}
```

### Step 5: Run tests

Run: `npm test -- tests/BubbleParser.test.ts`
Expected: PASS

### Step 6: Commit

```bash
git add src/game/Bubble.ts src/types/LevelData.ts tests/BubbleParser.test.ts
git commit -m "feat: add BubbleType, GridCell, and grid-cell parser"
```

---

## Task 2: Update Grid Model for Special Bubbles

**Files:**
- Modify: `src/game/Grid.ts`
- Test: `tests/GridSpecial.test.ts`

### Step 1: Write the failing test

Create `tests/GridSpecial.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Grid } from '../src/game/Grid';

describe('Grid with special bubbles', () => {
  it('findMatch excludes STONE bubbles', () => {
    const g = new Grid(3, 4);
    g.loadFromData([
      ['RED', 'RED', 'STONE', null],
      ['RED', null, null],
      [null, null, null, null],
    ]);
    const match = g.findMatch(0, 0);
    expect(match).toHaveLength(3);
    expect(match).toContainEqual({ row: 0, col: 0 });
    expect(match).toContainEqual({ row: 0, col: 1 });
    expect(match).toContainEqual({ row: 1, col: 0 });
  });

  it('getCellsInRadius returns correct ring-2 hex cells', () => {
    const g = new Grid(5, 6);
    g.loadFromData([
      ['RED', 'RED', 'RED', 'RED', 'RED', 'RED'],
      ['RED', 'RED', 'RED', 'RED', 'RED'],
      ['RED', 'RED', 'RED', 'RED', 'RED', 'RED'],
      ['RED', 'RED', 'RED', 'RED', 'RED'],
      ['RED', 'RED', 'RED', 'RED', 'RED', 'RED'],
    ]);
    const cells = g.getCellsInRadius(2, 2, 2);
    // Center + two hex rings should be 1 + 6 + 12 = 19 cells
    expect(cells).toHaveLength(19);
    expect(cells).toContainEqual({ row: 2, col: 2 });
    expect(cells).toContainEqual({ row: 0, col: 2 });
    expect(cells).toContainEqual({ row: 4, col: 2 });
  });

  it('damageCell reduces STONE hitPoints', () => {
    const g = new Grid(2, 4);
    g.loadFromData([
      [{ type: 'STONE', color: 'RED' }, null, null, null],
    ]);
    const cellBefore = g.getCell(0, 0)!;
    expect(cellBefore.hitPoints).toBe(2);
    g.damageCell(0, 0);
    const cellAfter = g.getCell(0, 0)!;
    expect(cellAfter.hitPoints).toBe(1);
  });

  it('damageCell destroys STONE at 1 HP', () => {
    const g = new Grid(2, 4);
    g.loadFromData([
      [{ type: 'STONE', color: 'RED' }, null, null, null],
    ]);
    g.damageCell(0, 0);
    g.damageCell(0, 0);
    expect(g.getCell(0, 0)?.color).toBeNull();
  });

  it('wildcard matches any color when effective color is provided', () => {
    const g = new Grid(3, 4);
    g.loadFromData([
      ['RED', { type: 'WILDCARD' }, 'RED', null],
      [null, null, null],
      [null, null, null, null],
    ]);
    // If we treat wildcard at (0,1) as RED, match should include (0,0),(0,1),(0,2)
    const match = g.findMatch(0, 1, 'RED');
    expect(match).toHaveLength(3);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- tests/GridSpecial.test.ts`
Expected: FAIL — `getCellsInRadius`, `damageCell` not defined; `findMatch` signature mismatch.

### Step 3: Write minimal implementation

Replace the entire contents of `src/game/Grid.ts`:

```typescript
import type { BubbleColor, BubbleType, GridCell } from './Bubble';
import { DEFAULT_HIT_POINTS } from './Bubble';
import { GRID_COLS, GRID_ROWS } from '../config';

export { GridCell } from './Bubble';

export class Grid {
  private cells: (GridCell | null)[][];
  readonly rows: number;
  readonly cols: number;

  constructor(rows = GRID_ROWS, cols = GRID_COLS) {
    this.rows = rows;
    this.cols = cols;
    this.cells = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: this.getColsForRow(r) }, () => ({ color: null, type: 'NORMAL' as BubbleType, hitPoints: 1 })),
    );
  }

  getColsForRow(row: number): number {
    return row % 2 === 0 ? this.cols : this.cols - 1;
  }

  getCell(row: number, col: number): GridCell | null {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.getColsForRow(row)) return null;
    return this.cells[row][col];
  }

  setCell(row: number, col: number, color: BubbleColor | null, type: BubbleType = 'NORMAL'): void {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.getColsForRow(row)) return;
    this.cells[row][col] = { color, type, hitPoints: DEFAULT_HIT_POINTS[type] };
  }

  loadFromData(data: unknown[][]): void {
    const { parseGridCellData } = require('./Bubble');
    data.forEach((rowData, r) => {
      if (r >= this.rows) return;
      rowData.forEach((cellData, c) => {
        if (c >= this.getColsForRow(r)) return;
        const parsed = parseGridCellData(cellData);
        this.cells[r][c] = parsed ?? { color: null, type: 'NORMAL', hitPoints: 1 };
      });
    });
  }

  damageCell(row: number, col: number): void {
    const cell = this.getCell(row, col);
    if (!cell || !cell.color) return;
    cell.hitPoints--;
    if (cell.hitPoints <= 0) {
      this.cells[row][col] = { color: null, type: 'NORMAL', hitPoints: 1 };
    }
  }

  private getNeighbors(row: number, col: number): Array<{ row: number; col: number }> {
    const isOdd = row % 2 === 1;
    const candidates = isOdd
      ? [
          { row: row - 1, col },
          { row: row - 1, col: col + 1 },
          { row, col: col - 1 },
          { row, col: col + 1 },
          { row: row + 1, col },
          { row: row + 1, col: col + 1 },
        ]
      : [
          { row: row - 1, col: col - 1 },
          { row: row - 1, col },
          { row, col: col - 1 },
          { row, col: col + 1 },
          { row: row + 1, col: col - 1 },
          { row: row + 1, col },
        ];
    return candidates.filter((c) => {
      if (c.row < 0 || c.row >= this.rows) return false;
      return c.col >= 0 && c.col < this.getColsForRow(c.row);
    });
  }

  findMatch(row: number, col: number, effectiveColor?: BubbleColor): Array<{ row: number; col: number }> {
    const cell = this.getCell(row, col);
    if (!cell?.color) return [];

    // STONE bubbles never match by color
    if (cell.type === 'STONE') return [];

    const target = effectiveColor ?? cell.color;
    const visited = new Set<string>();
    const queue: Array<{ row: number; col: number }> = [{ row, col }];
    const result: Array<{ row: number; col: number }> = [];

    while (queue.length > 0) {
      const cur = queue.shift()!;
      const key = `${cur.row},${cur.col}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const curCell = this.getCell(cur.row, cur.col);
      if (!curCell?.color) continue;

      // STONE never matches; WILDCARD always matches the target
      if (curCell.type === 'STONE') continue;
      if (curCell.type !== 'WILDCARD' && curCell.color !== target) continue;

      result.push(cur);
      for (const n of this.getNeighbors(cur.row, cur.col)) {
        if (!visited.has(`${n.row},${n.col}`)) queue.push(n);
      }
    }
    return result;
  }

  findBestWildcardMatch(row: number, col: number): Array<{ row: number; col: number }> {
    const neighbors = this.getNeighbors(row, col);
    const colorCounts = new Map<BubbleColor, number>();

    for (const n of neighbors) {
      const cell = this.getCell(n.row, n.col);
      if (cell?.color && cell.type !== 'STONE' && cell.type !== 'WILDCARD') {
        colorCounts.set(cell.color, (colorCounts.get(cell.color) ?? 0) + 1);
      }
    }

    let bestMatch: Array<{ row: number; col: number }> = [];
    for (const color of colorCounts.keys()) {
      const match = this.findMatch(row, col, color);
      if (match.length > bestMatch.length) {
        bestMatch = match;
      }
    }

    // If no neighbor colors, return just the wildcard cell itself (length 1, no pop)
    if (bestMatch.length === 0) bestMatch = [{ row, col }];
    return bestMatch;
  }

  getCellsInRadius(row: number, col: number, radius: number): Array<{ row: number; col: number }> {
    const result: Array<{ row: number; col: number }> = [];
    const visited = new Set<string>();
    const queue: Array<{ row: number; col: number; dist: number }> = [{ row, col, dist: 0 }];
    visited.add(`${row},${col}`);
    result.push({ row, col });

    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur.dist >= radius) continue;

      for (const n of this.getNeighbors(cur.row, cur.col)) {
        const key = `${n.row},${n.col}`;
        if (!visited.has(key)) {
          visited.add(key);
          result.push(n);
          queue.push({ row: n.row, col: n.col, dist: cur.dist + 1 });
        }
      }
    }
    return result;
  }

  findOrphans(): Array<{ row: number; col: number }> {
    const connected = new Set<string>();
    const queue: Array<{ row: number; col: number }> = [];

    for (let c = 0; c < this.getColsForRow(0); c++) {
      if (this.cells[0][c]?.color) {
        queue.push({ row: 0, col: c });
        connected.add(`0,${c}`);
      }
    }

    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const n of this.getNeighbors(cur.row, cur.col)) {
        const key = `${n.row},${n.col}`;
        if (!connected.has(key) && this.getCell(n.row, n.col)?.color) {
          connected.add(key);
          queue.push(n);
        }
      }
    }

    const orphans: Array<{ row: number; col: number }> = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.getColsForRow(r); c++) {
        if (this.cells[r][c]?.color && !connected.has(`${r},${c}`)) {
          orphans.push({ row: r, col: c });
        }
      }
    }
    return orphans;
  }

  countBubbles(): number {
    let n = 0;
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.getColsForRow(r); c++)
        if (this.cells[r][c]?.color) n++;
    return n;
  }

  isEmpty(): boolean {
    return this.countBubbles() === 0;
  }
}
```

### Step 4: Run tests

Run: `npm test -- tests/GridSpecial.test.ts`
Expected: PASS

### Step 5: Run ALL existing tests to check for regressions

Run: `npm test`
Expected: ALL PASS (Grid.test.ts, hexUtils.test.ts, etc. should still pass)

### Step 6: Commit

```bash
git add src/game/Grid.ts tests/GridSpecial.test.ts
git commit -m "feat: Grid supports STONE, BOMB radius, WILDCARD matching"
```

---

## Task 3: Generate Special Bubble Textures

**Files:**
- Modify: `src/scenes/BootScene.ts`

### Step 1: Modify BootScene.ts

Insert this method after `generateShooterTexture()` (after line 99):

```typescript
  private generateSpecialBubbleTextures(): void {
    const size = BUBBLE_RADIUS * 2;
    for (const color of ALL_COLORS) {
      // Stone texture
      const stoneKey = getBubbleTextureKey(color, 'STONE');
      if (!this.textures.exists(stoneKey)) {
        const ct = this.textures.createCanvas(stoneKey, size, size)!;
        const ctx = ct.context;
        ctx.fillStyle = '#555555';
        ctx.beginPath();
        ctx.arc(BUBBLE_RADIUS, BUBBLE_RADIUS, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 3;
        ctx.stroke();
        // Crack lines
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(BUBBLE_RADIUS * 0.3, BUBBLE_RADIUS * 0.3);
        ctx.lineTo(BUBBLE_RADIUS * 0.5, BUBBLE_RADIUS * 0.6);
        ctx.lineTo(BUBBLE_RADIUS * 0.7, BUBBLE_RADIUS * 0.4);
        ctx.stroke();
        ct.refresh();
      }

      // Bomb texture
      const bombKey = getBubbleTextureKey(color, 'BOMB');
      if (!this.textures.exists(bombKey)) {
        const ct = this.textures.createCanvas(bombKey, size, size)!;
        const ctx = ct.context;
        const { base, glow } = COLOR_CONFIG[color];
        const grad = ctx.createRadialGradient(
          BUBBLE_RADIUS * 0.5, BUBBLE_RADIUS * 0.5, 2,
          BUBBLE_RADIUS, BUBBLE_RADIUS, BUBBLE_RADIUS,
        );
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, base);
        grad.addColorStop(1, '#ff0000');
        ctx.beginPath();
        ctx.arc(BUBBLE_RADIUS, BUBBLE_RADIUS, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        // Fuse
        ctx.strokeStyle = '#ffd600';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(BUBBLE_RADIUS, 2);
        ctx.lineTo(BUBBLE_RADIUS, -4);
        ctx.stroke();
        ct.refresh();
      }

      // Wildcard texture
      const wildKey = getBubbleTextureKey(color, 'WILDCARD');
      if (!this.textures.exists(wildKey)) {
        const ct = this.textures.createCanvas(wildKey, size, size)!;
        const ctx = ct.context;
        const rainbow = ctx.createRadialGradient(
          BUBBLE_RADIUS * 0.5, BUBBLE_RADIUS * 0.5, 2,
          BUBBLE_RADIUS, BUBBLE_RADIUS, BUBBLE_RADIUS,
        );
        rainbow.addColorStop(0, '#ffffff');
        rainbow.addColorStop(0.2, '#ff6b6b');
        rainbow.addColorStop(0.4, '#fff176');
        rainbow.addColorStop(0.6, '#69f0ae');
        rainbow.addColorStop(0.8, '#7986ff');
        rainbow.addColorStop(1, '#ce93d8');
        ctx.beginPath();
        ctx.arc(BUBBLE_RADIUS, BUBBLE_RADIUS, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
        ctx.fillStyle = rainbow;
        ctx.fill();
        // Star symbol
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', BUBBLE_RADIUS, BUBBLE_RADIUS);
        ct.refresh();
      }
    }
  }
```

Then add the call in `create()` after `generateShooterTexture()` (line 28):

```typescript
    this.generateSpecialBubbleTextures();
```

Also add the imports at the top of `BootScene.ts`:

```typescript
import { ALL_COLORS, COLOR_CONFIG, getBubbleTextureKey, getShooterTextureKey, type BubbleType } from '../game/Bubble';
```

(Change existing import to include `type BubbleType`.)

### Step 2: Run build to verify no TypeScript errors

Run: `npm run build`
Expected: Build succeeds.

### Step 3: Commit

```bash
git add src/scenes/BootScene.ts
git commit -m "feat: generate stone, bomb, wildcard bubble textures"
```

---

## Task 4: Update Shooter to Queue Special Bubble Types

**Files:**
- Modify: `src/game/Shooter.ts`
- Modify: `src/scenes/GameScene.ts`

### Step 1: Replace Shooter.ts

```typescript
import Phaser from 'phaser';
import type { BubbleColor, BubbleType } from './Bubble';
import { getBubbleTextureKey, DEFAULT_HIT_POINTS } from './Bubble';
import { SHOOTER_X, SHOOTER_Y, BUBBLE_RADIUS, MIN_SHOOT_ANGLE, SHOOT_COOLDOWN, BUBBLE_IDLE_PULSE_SCALE, BUBBLE_IDLE_PULSE_DURATION } from '../config';

export interface QueuedBubble {
  color: BubbleColor;
  type: BubbleType;
}

export class Shooter extends Phaser.Events.EventEmitter {
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
    this.currentSprite = this.scene.add.image(SHOOTER_X, SHOOTER_Y - BUBBLE_RADIUS * 1.5, getBubbleTextureKey(this.current.color, this.current.type));
    this.scene.tweens.add({
      targets: this.currentSprite,
      scaleX: BUBBLE_IDLE_PULSE_SCALE,
      scaleY: BUBBLE_IDLE_PULSE_SCALE,
      duration: BUBBLE_IDLE_PULSE_DURATION / 2,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.nextSprite = this.scene.add.image(SHOOTER_X + 52, SHOOTER_Y + 10, getBubbleTextureKey(this.next.color, this.next.type)).setScale(0.75);
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

    this.emit('fire', this.current.color, this.aimAngle, this.current.type);

    this.current = this.next;
    this.next = this.randomBubble();
    this.currentSprite.setTexture(getBubbleTextureKey(this.current.color, this.current.type));
    this.nextSprite.setTexture(getBubbleTextureKey(this.next.color, this.next.type));

    this.scene.time.delayedCall(SHOOT_COOLDOWN, () => { this.cooldown = false; });
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
    this.currentSprite.destroy();
    this.nextSprite.destroy();
    this.removeAllListeners();
  }
}
```

### Step 2: Update GameScene.ts shooter creation

Find in `GameScene.ts` (around line 72):

```typescript
    this.shooter = new Shooter(this, this.levelData.colors as BubbleColor[]);
```

Replace with:

```typescript
    const specialTypes: BubbleType[] = [];
    if (this.levelData.specialBubbles?.stone) specialTypes.push('STONE');
    if (this.levelData.specialBubbles?.bomb) specialTypes.push('BOMB');
    if (this.levelData.specialBubbles?.wildcard) specialTypes.push('WILDCARD');
    const specialChance = this.levelData.shooterSpecialChance ?? 0;
    this.shooter = new Shooter(this, this.levelData.colors as BubbleColor[], specialTypes, specialChance);
```

### Step 3: Update FlyingBubble type and onShooterFire

Find in `GameScene.ts` (line 20):

```typescript
type FlyingBubble = Phaser.GameObjects.Image & { vx: number; vy: number; bubbleColor: BubbleColor };
```

Replace with:

```typescript
type FlyingBubble = Phaser.GameObjects.Image & { vx: number; vy: number; bubbleColor: BubbleColor; bubbleType: BubbleType };
```

Find `onShooterFire` (around line 175):

```typescript
  private onShooterFire(color: BubbleColor, angle: number): void {
```

Replace with:

```typescript
  private onShooterFire(color: BubbleColor, angle: number, type: BubbleType = 'NORMAL'): void {
    const vx = Math.sin(angle) * BUBBLE_SPEED;
    const vy = -Math.cos(angle) * BUBBLE_SPEED;
    const bubble = this.add.image(SHOOTER_X, SHOOTER_Y - BUBBLE_RADIUS * 1.5, getBubbleTextureKey(color, type)) as FlyingBubble;
    bubble.vx = vx;
    bubble.vy = vy;
    bubble.bubbleColor = color;
    bubble.bubbleType = type;
    this.flyingBubbles.push(bubble);
    AudioManager.getInstance().playShoot();
  }
```

Also update `placeBubble` call in `update()` (around line 127):

Find:
```typescript
        this.placeBubble(b.bubbleColor, snapCell.row, snapCell.col);
```

Replace with:
```typescript
        this.placeBubble(b.bubbleColor, snapCell.row, snapCell.col, b.bubbleType);
```

### Step 4: Run build

Run: `npm run build`
Expected: No errors.

### Step 5: Commit

```bash
git add src/game/Shooter.ts src/scenes/GameScene.ts
git commit -m "feat: shooter queues special bubble types"
```

---

## Task 5: Implement Stone, Bomb, and Wildcard Game Logic

**Files:**
- Modify: `src/scenes/GameScene.ts`

### Step 1: Update `placeBubble` signature and body

Find `placeBubble` (around line 237):

```typescript
  private placeBubble(color: BubbleColor, row: number, col: number): void {
    this.grid.setCell(row, col, color);
```

Replace with:

```typescript
  private placeBubble(color: BubbleColor, row: number, col: number, type: BubbleType = 'NORMAL'): void {
    this.grid.setCell(row, col, color, type);
```

And update the sprite texture key:

Find:
```typescript
    const sprite = this.add.image(x, y, getBubbleTextureKey(color));
```

Replace with:
```typescript
    const sprite = this.add.image(x, y, getBubbleTextureKey(color, type));
```

### Step 2: Rewrite `processMatch` for special bubbles

Replace `processMatch` (lines 249–295) with:

```typescript
  private processMatch(row: number, col: number): void {
    const cell = this.grid.getCell(row, col);
    if (!cell) { this.advanceTurn(); return; }

    let matched: Array<{ row: number; col: number }> = [];

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

    matched.forEach(({ row: r, col: c }) => {
      const targetCell = this.grid.getCell(r, c);
      if (!targetCell?.color) return;

      if (targetCell.type === 'STONE') {
        this.grid.damageCell(r, c);
        const sprite = this.gridSprites.get(`${r},${c}`);
        if (sprite) {
          // Flash white to indicate hit
          this.tweens.add({ targets: sprite, alpha: 0.4, duration: 80, yoyo: true });
        }
        return;
      }

      this.removeCellSprite(r, c);
      this.grid.setCell(r, c, null);
    });

    const actuallyPopped = matched.filter(({ row: r, col: c }) => {
      const afterCell = this.grid.getCell(r, c);
      return !afterCell?.color;
    });

    this.score += actuallyPopped.length * SCORE_PER_POP;
    if (actuallyPopped.length > 0) {
      AudioManager.getInstance().playPop();
      this.events.emit('score-update', this.score);
      this.effects.shakeCamera(actuallyPopped.length);
      this.spawnScoreText(popX, popY, actuallyPopped.length * SCORE_PER_POP);
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
```

### Step 3: Run build

Run: `npm run build`
Expected: No errors.

### Step 4: Commit

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: stone damage, bomb radius pop, wildcard best-match logic"
```

---

## Task 6: Aim Assist Power-up

**Files:**
- Modify: `src/game/Trajectory.ts`
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/scenes/UIScene.ts`
- Modify: `src/config.ts`

### Step 1: Update Trajectory.ts

Replace the entire contents of `src/game/Trajectory.ts`:

```typescript
import Phaser from 'phaser';
import {
  GAME_WIDTH, BUBBLE_RADIUS, SHOOTER_X, SHOOTER_Y,
  GRID_ORIGIN_Y, MAX_TRAJECTORY_BOUNCES, MIN_SHOOT_ANGLE,
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
    const clampedAngle = Phaser.Math.Clamp(aimAngle, -(halfPi - MIN_SHOOT_ANGLE), halfPi - MIN_SHOOT_ANGLE);

    const segments = this.computeSegments(clampedAngle);
    this.drawSegments(segments);
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private computeSegments(angle: number): Segment[] {
    const maxBounces = this.aimAssist ? MAX_TRAJECTORY_BOUNCES + AIM_ASSIST_EXTRA_BOUNCES : MAX_TRAJECTORY_BOUNCES;
    const segments: Segment[] = [];
    let x = SHOOTER_X;
    let y = SHOOTER_Y - BUBBLE_RADIUS - 4;
    let dx = Math.sin(angle);
    let dy = -Math.cos(angle);
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
      y = y + dy * tWall;
      dx = -dx;
    }

    return segments;
  }

  private drawSegments(segments: Segment[]): void {
    const DOT_SPACING = 12;
    const color = this.aimAssist ? 0x69f0ae : 0x00e5ff;
    const alpha = this.aimAssist ? 0.75 : 0.55;
    this.graphics.fillStyle(color, alpha);

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
```

### Step 2: Update GameScene.ts to handle aim assist

Add a private field near the top of `GameScene` (around line 36):

```typescript
  private aimAssistActive = false;
```

In `create()` (after `this.trajectory = new Trajectory(this);` around line 75), add:

```typescript
    this.events.on('activate-aim-assist', () => {
      this.aimAssistActive = true;
      this.trajectory.setAimAssist(true);
    });
```

### Step 3: Update UIScene.ts to add power-up buttons

Add after `createMuteButton()` in `UIScene.ts` (around line 78):

```typescript
  private createPowerUpButtons(): void {
    const y = 80;
    const aimBtn = this.add.text(GAME_WIDTH / 2 - 50, y, 'AIM', {
      fontSize: '12px', color: '#69f0ae', fontFamily: 'monospace', backgroundColor: '#1a2540',
    }).setPadding(6, 4).setOrigin(0.5).setInteractive({ useHandCursor: true });

    aimBtn.on('pointerdown', () => {
      this.scene.get('GameScene').events.emit('activate-aim-assist');
      aimBtn.setAlpha(0.3);
      aimBtn.disableInteractive();
    });

    const colorBombBtn = this.add.text(GAME_WIDTH / 2 + 50, y, 'BOMB', {
      fontSize: '12px', color: '#ff4081', fontFamily: 'monospace', backgroundColor: '#1a2540',
    }).setPadding(6, 4).setOrigin(0.5).setInteractive({ useHandCursor: true });

    colorBombBtn.on('pointerdown', () => {
      this.scene.get('GameScene').events.emit('activate-color-bomb');
      colorBombBtn.setAlpha(0.3);
      colorBombBtn.disableInteractive();
    });
  }
```

Call it in `create()` after `this.createMuteButton();` (around line 77):

```typescript
    this.createPowerUpButtons();
```

### Step 4: Run build

Run: `npm run build`
Expected: No errors.

### Step 5: Commit

```bash
git add src/game/Trajectory.ts src/scenes/GameScene.ts src/scenes/UIScene.ts src/config.ts
git commit -m "feat: aim assist power-up extends trajectory preview"
```

---

## Task 7: Color Bomb Power-up

**Files:**
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/scenes/UIScene.ts`
- Modify: `src/config.ts`

### Step 1: Update GameScene.ts

Add private field near top:

```typescript
  private colorBombPending = false;
```

In `create()`, after the aim-assist event listener, add:

```typescript
    this.events.on('activate-color-bomb', () => {
      this.colorBombPending = true;
      this.showColorPicker();
    });
```

Add these methods to `GameScene`:

```typescript
  private showColorPicker(): void {
    const colors = this.levelData.colors as BubbleColor[];
    const btnY = GAME_HEIGHT / 2;
    const startX = GAME_WIDTH / 2 - ((colors.length - 1) * 50) / 2;

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setDepth(20);
    const label = this.add.text(GAME_WIDTH / 2, btnY - 60, 'PICK COLOR TO CLEAR', {
      fontSize: '18px', color: '#ff4081', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(21);

    const buttons: Phaser.GameObjects.Image[] = [];

    colors.forEach((color, i) => {
      const btn = this.add.image(startX + i * 50, btnY, getBubbleTextureKey(color)).setInteractive({ useHandCursor: true }).setDepth(21);
      buttons.push(btn);
      btn.on('pointerdown', () => {
        this.executeColorBomb(color);
        overlay.destroy();
        label.destroy();
        buttons.forEach((b) => b.destroy());
      });
    });
  }

  private executeColorBomb(targetColor: BubbleColor): void {
    this.colorBombPending = false;
    let cleared = 0;

    for (let r = 0; r < this.grid.rows; r++) {
      for (let c = 0; c < this.grid.getColsForRow(r); c++) {
        const cell = this.grid.getCell(r, c);
        if (cell?.color === targetColor && cell.type === 'NORMAL') {
          this.removeCellSprite(r, c);
          this.grid.setCell(r, c, null);
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
```

Also add `COLOR_BOMB_SCORE` to the config import at the top of `GameScene.ts` if not already imported. Verify the import from `../config` includes `COLOR_BOMB_SCORE`.

### Step 2: Block shooting while color bomb picker is open

In `GameScene.ts`, in the `pointerdown` handler (around line 86), add at the top:

```typescript
      if (this.colorBombPending) return;
```

### Step 3: Run build

Run: `npm run build`
Expected: No errors.

### Step 4: Commit

```bash
git add src/scenes/GameScene.ts src/scenes/UIScene.ts src/config.ts
git commit -m "feat: color bomb power-up clears all bubbles of chosen color"
```

---

## Task 8: Update Level JSON with Special Bubble Configuration

**Files:**
- Modify: `src/data/levels/level-004.json`
- Modify: `src/data/levels/level-005.json`

### Step 1: Update level-004.json

Replace `src/data/levels/level-004.json`:

```json
{
  "id": 4,
  "name": "Operation Granite",
  "type": "moves",
  "moves": 35,
  "colors": ["RED", "BLUE", "GREEN", "YELLOW"],
  "grid": [
    ["RED", "BLUE", { "type": "STONE", "color": "RED" }, "GREEN", "RED", "BLUE", "RED", "BLUE"],
    ["BLUE", "RED", "GREEN", "RED", "BLUE", "RED", "BLUE"],
    ["RED", "YELLOW", "RED", "YELLOW", "RED", "YELLOW", "RED", "YELLOW"],
    ["YELLOW", "RED", "BLUE", "RED", "BLUE", "RED", "BLUE"],
    ["BLUE", { "type": "STONE", "color": "BLUE" }, "YELLOW", "YELLOW", "RED", "RED", "BLUE", "BLUE"]
  ],
  "stars": [1000, 2200, 3500],
  "descentInterval": 0,
  "specialBubbles": {
    "stone": true,
    "bomb": false,
    "wildcard": false
  },
  "shooterSpecialChance": 0
}
```

### Step 2: Update level-005.json with all special types

Replace `src/data/levels/level-005.json`:

```json
{
  "id": 5,
  "name": "Operation Wildcard",
  "type": "moves",
  "moves": 30,
  "colors": ["RED", "BLUE", "YELLOW", "PURPLE"],
  "grid": [
    ["RED", "BLUE", { "type": "WILDCARD" }, "YELLOW", "RED", "BLUE", "RED", "BLUE"],
    ["BLUE", "RED", "YELLOW", "RED", "BLUE", "RED", "BLUE"],
    ["RED", { "type": "BOMB", "color": "RED" }, "RED", "YELLOW", "RED", "YELLOW", "RED", "YELLOW"],
    ["YELLOW", "RED", "BLUE", "RED", "BLUE", "RED", "BLUE"],
    ["BLUE", "BLUE", "YELLOW", "YELLOW", "RED", "RED", "BLUE", "BLUE"]
  ],
  "stars": [1200, 2600, 4200],
  "descentInterval": 0,
  "specialBubbles": {
    "stone": true,
    "bomb": true,
    "wildcard": true
  },
  "shooterSpecialChance": 0.1
}
```

### Step 3: Verify levels load without error

Run: `npm run build`
Expected: Build succeeds (JSON is valid).

### Step 4: Commit

```bash
git add src/data/levels/level-004.json src/data/levels/level-005.json
git commit -m "feat: add special bubble configs to levels 4 and 5"
```

---

## Task 9: Full Test Suite & Regression Check

**Files:**
- Test: `tests/GridSpecial.test.ts` (already created)
- Test: `tests/BubbleParser.test.ts` (already created)

### Step 1: Run all tests

Run: `npm test`
Expected: All tests pass. Output should show:
- `Grid.findMatch` tests pass
- `Grid.findOrphans` tests pass
- `GridSpecial` tests pass
- `BubbleParser` tests pass
- All other existing tests pass

### Step 2: Run TypeScript check

Run: `npm run build`
Expected: Zero errors.

### Step 3: Commit

```bash
git commit -m "test: verify all tests pass with special bubble features"
```

---

## Self-Review Checklist

### 1. Spec Coverage

| Spec Requirement | Implementing Task |
|-----------------|-------------------|
| Stone bubble (requires 2 hits) | Task 2 (`Grid.damageCell`, `DEFAULT_HIT_POINTS.STONE=2`), Task 5 (processMatch damage) |
| Bomb bubble (pops 2-ring radius) | Task 2 (`Grid.getCellsInRadius`), Task 5 (BOMB type in processMatch) |
| Wildcard bubble (matches any color) | Task 2 (`Grid.findBestWildcardMatch`, `findMatch` with effectiveColor), Task 5 |
| Power-up: aim assist (extended trajectory) | Task 6 (`Trajectory` aimAssist mode, UIScene button) |
| Power-up: color bomb (clear all of one color) | Task 7 (`executeColorBomb`, color picker UI) |
| Per-level special bubble configs in JSON | Task 8 (`specialBubbles`, `shooterSpecialChance` in LevelData and JSONs) |

**No gaps.**

### 2. Placeholder Scan

- No "TBD", "TODO", "implement later", "fill in details" found.
- No vague "add appropriate error handling" steps.
- Every code step includes the actual code.
- No "Similar to Task N" references.
- All types, functions, and methods are defined in prior tasks before being referenced.

### 3. Type Consistency

- `BubbleType` used consistently: `'NORMAL' | 'STONE' | 'BOMB' | 'WILDCARD'`
- `GridCell` has `color`, `type`, `hitPoints` everywhere
- `getBubbleTextureKey(color, type)` signature consistent
- `QueuedBubble` interface used in Shooter
- `BOMB_RADIUS` from config used in `getCellsInRadius`
- `AIM_ASSIST_EXTRA_BOUNCES` from config used in Trajectory
- `COLOR_BOMB_SCORE` from config used in GameScene

All consistent.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-09-phase-4-special-bubbles.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review.

**Which approach?**

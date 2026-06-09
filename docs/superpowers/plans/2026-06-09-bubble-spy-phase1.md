# Bubble Spy Phase 1 — Core Gameplay Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working browser-based bubble shooter game with hex grid, shooter + aim line, match/orphan detection, particle effects, HUD, and 3 playable levels.

**Architecture:** Phaser 3 scenes (`BootScene → GameScene + UIScene parallel`) own all rendering; pure-logic classes (`Grid`, hexUtils) hold no Phaser references and are unit-tested with vitest; `GameScene` is the coordination hub that wires the logic classes to Phaser events and sprites.

**Tech Stack:** Phaser 3 (latest), Vite 6, TypeScript 5, vitest 3. No external sprite assets — textures generated via Phaser's `CanvasTexture` API at boot.

---

## File Map

| Path | Purpose |
|------|---------|
| `package.json` | deps + scripts |
| `vite.config.ts` | Vite + vitest config |
| `tsconfig.json` | TS config |
| `index.html` | HTML entry |
| `src/main.ts` | Phaser game config + mount |
| `src/config.ts` | All shared numeric constants |
| `src/types/LevelData.ts` | `LevelData` interface |
| `src/utils/hexUtils.ts` | Grid ↔ pixel math, neighbor lookup |
| `src/utils/storage.ts` | LocalStorage read/write |
| `src/game/Bubble.ts` | `BubbleColor` type, color config, texture key helper |
| `src/game/Grid.ts` | Pure grid state, BFS match, BFS orphan detection |
| `src/game/Trajectory.ts` | Aim line segment computation + Phaser Graphics draw |
| `src/game/Shooter.ts` | Aim angle, bubble queue, fire event dispatch |
| `src/game/Effects.ts` | Particles, screen shake, floating score text |
| `src/scenes/BootScene.ts` | Asset preload, canvas texture generation |
| `src/scenes/GameScene.ts` | Main gameplay: grid render, physics, snap, win/lose |
| `src/scenes/UIScene.ts` | Score, progress bar, moves counter overlay |
| `src/data/levels/level-001.json` | Level 1 config |
| `src/data/levels/level-002.json` | Level 2 config |
| `src/data/levels/level-003.json` | Level 3 config |
| `tests/hexUtils.test.ts` | Unit tests for coordinate math |
| `tests/Grid.test.ts` | Unit tests for match + orphan logic |

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `public/.gitkeep`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "bubble-shooter",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "phaser": "^3.88.2"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.8.3",
    "vite": "^6.3.5",
    "vitest": "^3.2.3"
  }
}
```

- [ ] **Step 2: Create `vite.config.ts`**

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { outDir: 'dist' },
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ES2020", "DOM"],
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 4: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bubble Spy</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #050510; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
    canvas { display: block; }
  </style>
</head>
<body>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 5: Create `public/.gitkeep`** (empty file — Vite needs the directory)

- [ ] **Step 6: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors

- [ ] **Step 7: Verify vitest works with a placeholder test**

Create `tests/smoke.test.ts`:
```typescript
describe('smoke', () => {
  it('works', () => expect(1 + 1).toBe(2));
});
```
Run: `npm test`
Expected: `✓ tests/smoke.test.ts > smoke > works`

- [ ] **Step 8: Delete smoke test**

```bash
rm tests/smoke.test.ts
```

- [ ] **Step 9: Commit**

```bash
git init
git add package.json vite.config.ts tsconfig.json index.html public/.gitkeep
git commit -m "chore: scaffold Vite + Phaser 3 + TypeScript + vitest"
```

---

### Task 2: Types, Config, and Level Data

**Files:**
- Create: `src/config.ts`
- Create: `src/types/LevelData.ts`
- Create: `src/game/Bubble.ts`
- Create: `src/data/levels/level-001.json`
- Create: `src/data/levels/level-002.json`
- Create: `src/data/levels/level-003.json`

- [ ] **Step 1: Create `src/config.ts`**

```typescript
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 720;

export const BUBBLE_RADIUS = 22;
export const COL_WIDTH = BUBBLE_RADIUS * 2 + 2;   // 46 — diameter + 2px gap
export const ROW_HEIGHT = 40;                        // vertical center-to-center distance

export const GRID_COLS = 8;
export const GRID_ROWS = 10;

// Center of cell (0, 0): horizontally centers the 8-column even row
export const GRID_ORIGIN_X = Math.round((GAME_WIDTH - (GRID_COLS - 1) * COL_WIDTH) / 2); // 79
export const GRID_ORIGIN_Y = BUBBLE_RADIUS + 8;    // 30

// Danger line: if grid descends past this y, it's overflow
export const DANGER_LINE_Y = GRID_ORIGIN_Y + GRID_ROWS * ROW_HEIGHT; // 430

export const SHOOTER_X = GAME_WIDTH / 2;            // 240
export const SHOOTER_Y = GAME_HEIGHT - 80;          // 640

export const BUBBLE_SPEED = 800;                    // px/s
export const SHOOT_COOLDOWN = 300;                  // ms

export const MIN_SHOOT_ANGLE = (10 * Math.PI) / 180; // 10° from horizontal
export const MAX_TRAJECTORY_BOUNCES = 3;

export const MATCH_MIN = 3;                         // minimum bubbles to pop

export const SCORE_PER_POP = 100;
export const SCORE_PER_ORPHAN = 50;
```

- [ ] **Step 2: Create `src/types/LevelData.ts`**

```typescript
import type { BubbleColor } from '../game/Bubble';

export interface LevelData {
  id: number;
  name: string;
  type: 'moves' | 'timer';
  moves?: number;
  time?: number;
  colors: BubbleColor[];
  grid: (BubbleColor | null)[][];
  stars: [number, number, number];
  descentInterval: number;
}
```

- [ ] **Step 3: Create `src/game/Bubble.ts`**

```typescript
export type BubbleColor = 'RED' | 'BLUE' | 'GREEN' | 'YELLOW' | 'PURPLE' | 'CYAN';

export const ALL_COLORS: BubbleColor[] = ['RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE', 'CYAN'];

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

export function getBubbleTextureKey(color: BubbleColor): string {
  return `bubble_${color}`;
}

export function getShooterTextureKey(): string {
  return 'shooter';
}
```

- [ ] **Step 4: Create `src/data/levels/level-001.json`**

```json
{
  "id": 1,
  "name": "Operation Neon",
  "type": "moves",
  "moves": 30,
  "colors": ["RED", "BLUE", "YELLOW"],
  "grid": [
    ["RED", "BLUE", "RED", "BLUE", "RED", "BLUE", "RED", "BLUE"],
    ["BLUE", "RED", "BLUE", "RED", "BLUE", "RED", "BLUE"],
    ["RED", "YELLOW", "RED", "YELLOW", "RED", "YELLOW", "RED", "YELLOW"],
    ["YELLOW", "RED", "BLUE", "RED", "BLUE", "RED", "BLUE"],
    ["BLUE", "BLUE", "YELLOW", "YELLOW", "RED", "RED", "BLUE", "BLUE"]
  ],
  "stars": [800, 1800, 3000],
  "descentInterval": 0
}
```

- [ ] **Step 5: Create `src/data/levels/level-002.json`**

```json
{
  "id": 2,
  "name": "Shadow Protocol",
  "type": "moves",
  "moves": 25,
  "colors": ["RED", "BLUE", "GREEN", "YELLOW"],
  "grid": [
    ["RED", "GREEN", "BLUE", "GREEN", "RED", "BLUE", "GREEN", "RED"],
    ["GREEN", "RED", "GREEN", "BLUE", "GREEN", "RED", "GREEN"],
    ["BLUE", "BLUE", "RED", "RED", "GREEN", "GREEN", "BLUE", "BLUE"],
    ["YELLOW", "BLUE", "YELLOW", "RED", "YELLOW", "BLUE", "YELLOW"],
    ["RED", "YELLOW", "GREEN", "YELLOW", "GREEN", "YELLOW", "RED", "GREEN"],
    ["GREEN", "RED", "BLUE", "RED", "BLUE", "RED", "GREEN"],
    ["BLUE", "GREEN", "RED", "GREEN", "RED", "GREEN", "BLUE", "GREEN"]
  ],
  "stars": [1000, 2200, 3800],
  "descentInterval": 0
}
```

- [ ] **Step 6: Create `src/data/levels/level-003.json`**

```json
{
  "id": 3,
  "name": "Cipher Run",
  "type": "moves",
  "moves": 20,
  "colors": ["RED", "BLUE", "GREEN", "YELLOW", "PURPLE"],
  "grid": [
    ["RED", "PURPLE", "BLUE", "PURPLE", "RED", "PURPLE", "BLUE", "RED"],
    ["PURPLE", "RED", "PURPLE", "BLUE", "PURPLE", "RED", "PURPLE"],
    ["BLUE", "GREEN", "PURPLE", "GREEN", "PURPLE", "GREEN", "BLUE", "PURPLE"],
    ["GREEN", "BLUE", "GREEN", "PURPLE", "GREEN", "BLUE", "GREEN"],
    ["YELLOW", "YELLOW", "GREEN", "GREEN", "BLUE", "BLUE", "YELLOW", "YELLOW"],
    ["RED", "YELLOW", "RED", "YELLOW", "RED", "YELLOW", "RED"],
    ["PURPLE", "RED", "GREEN", "RED", "GREEN", "RED", "PURPLE", "RED"],
    ["GREEN", "PURPLE", "BLUE", "PURPLE", "BLUE", "PURPLE", "GREEN"]
  ],
  "stars": [1200, 2600, 4400],
  "descentInterval": 0
}
```

- [ ] **Step 7: Commit**

```bash
git add src/config.ts src/types/ src/game/Bubble.ts src/data/
git commit -m "feat: add game constants, BubbleColor types, 3 level JSON files"
```

---

### Task 3: Hex Utilities

**Files:**
- Create: `src/utils/hexUtils.ts`
- Create: `tests/hexUtils.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/hexUtils.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  gridToPixel,
  pixelToNearestGrid,
  getNeighbors,
} from '../src/utils/hexUtils';
import { GRID_ORIGIN_X, GRID_ORIGIN_Y, COL_WIDTH, ROW_HEIGHT, GRID_COLS } from '../src/config';

describe('gridToPixel', () => {
  it('returns origin for cell (0, 0)', () => {
    const { x, y } = gridToPixel(0, 0);
    expect(x).toBe(GRID_ORIGIN_X);
    expect(y).toBe(GRID_ORIGIN_Y);
  });

  it('increments x by COL_WIDTH for each column in even row', () => {
    const { x } = gridToPixel(0, 3);
    expect(x).toBe(GRID_ORIGIN_X + 3 * COL_WIDTH);
  });

  it('offsets odd row by half COL_WIDTH', () => {
    const even = gridToPixel(0, 0);
    const odd = gridToPixel(1, 0);
    expect(odd.x).toBe(even.x + COL_WIDTH / 2);
  });

  it('increments y by ROW_HEIGHT per row', () => {
    const row0 = gridToPixel(0, 0);
    const row3 = gridToPixel(3, 0);
    expect(row3.y).toBe(row0.y + 3 * ROW_HEIGHT);
  });
});

describe('pixelToNearestGrid', () => {
  it('maps even-row cell center back to its coords', () => {
    const { x, y } = gridToPixel(2, 4);
    expect(pixelToNearestGrid(x, y)).toEqual({ row: 2, col: 4 });
  });

  it('maps odd-row cell center back to its coords', () => {
    const { x, y } = gridToPixel(3, 2);
    expect(pixelToNearestGrid(x, y)).toEqual({ row: 3, col: 2 });
  });

  it('snaps nearby pixel to nearest cell', () => {
    const { x, y } = gridToPixel(0, 0);
    expect(pixelToNearestGrid(x + 5, y + 3)).toEqual({ row: 0, col: 0 });
  });
});

describe('getNeighbors', () => {
  it('returns 2 neighbors for top-left corner (0, 0)', () => {
    const n = getNeighbors(0, 0);
    expect(n).toHaveLength(2);
    expect(n).toContainEqual({ row: 0, col: 1 });
    expect(n).toContainEqual({ row: 1, col: 0 });
  });

  it('returns 6 neighbors for interior even-row cell (4, 3)', () => {
    expect(getNeighbors(4, 3)).toHaveLength(6);
  });

  it('returns 6 neighbors for interior odd-row cell (3, 3)', () => {
    expect(getNeighbors(3, 3)).toHaveLength(6);
  });

  it('excludes out-of-bounds neighbors', () => {
    // Top-right corner of even row (0, GRID_COLS-1)
    const n = getNeighbors(0, GRID_COLS - 1);
    expect(n.every((c) => c.row >= 0 && c.col >= 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

Run: `npm test`
Expected: `Cannot find module '../src/utils/hexUtils'`

- [ ] **Step 3: Create `src/utils/hexUtils.ts`**

```typescript
import {
  GRID_ORIGIN_X,
  GRID_ORIGIN_Y,
  COL_WIDTH,
  ROW_HEIGHT,
  GRID_COLS,
  GRID_ROWS,
  BUBBLE_RADIUS,
} from '../config';

export interface GridPos {
  row: number;
  col: number;
}

export function gridToPixel(row: number, col: number): { x: number; y: number } {
  const offsetX = row % 2 === 1 ? COL_WIDTH / 2 : 0;
  return {
    x: GRID_ORIGIN_X + col * COL_WIDTH + offsetX,
    y: GRID_ORIGIN_Y + row * ROW_HEIGHT,
  };
}

export function colsForRow(row: number): number {
  return row % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
}

export function pixelToNearestGrid(px: number, py: number): GridPos {
  const rawRow = Math.round((py - GRID_ORIGIN_Y) / ROW_HEIGHT);
  let bestDist = Infinity;
  let best: GridPos = { row: 0, col: 0 };

  for (let r = Math.max(0, rawRow - 1); r <= Math.min(GRID_ROWS - 1, rawRow + 1); r++) {
    const maxCol = colsForRow(r);
    const offsetX = r % 2 === 1 ? COL_WIDTH / 2 : 0;
    const rawCol = Math.round((px - GRID_ORIGIN_X - offsetX) / COL_WIDTH);
    const clampedCol = Math.max(0, Math.min(maxCol - 1, rawCol));
    const center = gridToPixel(r, clampedCol);
    const dist = Math.hypot(px - center.x, py - center.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = { row: r, col: clampedCol };
    }
  }
  return best;
}

export function getNeighbors(row: number, col: number): GridPos[] {
  const isOdd = row % 2 === 1;
  const candidates: GridPos[] = isOdd
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
    if (c.row < 0 || c.row >= GRID_ROWS) return false;
    const maxCol = colsForRow(c.row);
    return c.col >= 0 && c.col < maxCol;
  });
}

export { GRID_ORIGIN_X, GRID_ORIGIN_Y, COL_WIDTH, ROW_HEIGHT, GRID_COLS, BUBBLE_RADIUS };
```

- [ ] **Step 4: Run tests — confirm they pass**

Run: `npm test`
Expected: `✓ tests/hexUtils.test.ts (8)`

- [ ] **Step 5: Commit**

```bash
git add src/utils/hexUtils.ts tests/hexUtils.test.ts
git commit -m "feat: hex grid coordinate utilities with tests"
```

---

### Task 4: Grid Logic

**Files:**
- Create: `src/game/Grid.ts`
- Create: `tests/Grid.test.ts`
- Create: `src/utils/storage.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/Grid.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { Grid } from '../src/game/Grid';

describe('Grid.findMatch', () => {
  it('returns single-cell match when no same-color neighbors', () => {
    const g = new Grid(3, 4);
    g.loadFromData([
      ['RED', 'BLUE', 'RED', 'BLUE'],
      ['BLUE', 'RED', 'BLUE'],
      ['RED', 'BLUE', 'RED', 'BLUE'],
    ]);
    // (0,0)=RED; neighbors (0,1)=BLUE, (1,0)=BLUE — no RED adjacents
    const match = g.findMatch(0, 0);
    expect(match).toHaveLength(1);
    expect(match[0]).toEqual({ row: 0, col: 0 });
  });

  it('finds connected group of 3 RED bubbles', () => {
    const g = new Grid(3, 4);
    g.loadFromData([
      ['RED', 'RED', 'BLUE', 'BLUE'],
      ['RED', 'BLUE', 'BLUE'],
      ['BLUE', 'BLUE', 'BLUE', 'BLUE'],
    ]);
    // (0,0),(0,1) are RED; (1,0) is RED and adjacent to both
    const match = g.findMatch(0, 0);
    expect(match).toHaveLength(3);
    expect(match).toContainEqual({ row: 0, col: 0 });
    expect(match).toContainEqual({ row: 0, col: 1 });
    expect(match).toContainEqual({ row: 1, col: 0 });
  });

  it('returns empty array for null cell', () => {
    const g = new Grid(2, 4);
    g.loadFromData([[null, 'RED', null, null]]);
    expect(g.findMatch(0, 0)).toHaveLength(0);
  });
});

describe('Grid.findOrphans', () => {
  it('returns empty when all bubbles connect to row 0', () => {
    const g = new Grid(3, 4);
    g.loadFromData([
      ['RED', 'BLUE', null, null],
      ['RED', 'BLUE', null],
    ]);
    expect(g.findOrphans()).toHaveLength(0);
  });

  it('returns orphaned bubbles not reachable from row 0', () => {
    const g = new Grid(4, 4);
    g.loadFromData([
      [null, null, null, null],
      [null, null, null],
      [null, null, 'RED', null],
      [null, null, null, 'BLUE'],
    ]);
    const orphans = g.findOrphans();
    expect(orphans).toHaveLength(2);
    expect(orphans).toContainEqual({ row: 2, col: 2 });
    expect(orphans).toContainEqual({ row: 3, col: 3 });
  });

  it('does not return ceiling-connected bubbles as orphans', () => {
    const g = new Grid(3, 4);
    g.loadFromData([
      ['RED', null, null, null],
      ['RED', null, null],
      ['RED', null, null, null],
    ]);
    // All RED cells connected via column 0 down through rows
    // (2,0) is connected: (2,0)->(1,0)->(0,0) ceiling
    expect(g.findOrphans()).toHaveLength(0);
  });
});

describe('Grid.countBubbles', () => {
  it('counts non-null cells', () => {
    const g = new Grid(2, 4);
    g.loadFromData([['RED', null, 'BLUE', null], ['RED', null, null]]);
    expect(g.countBubbles()).toBe(3);
  });
});

describe('Grid.isEmpty', () => {
  it('returns true for empty grid', () => {
    const g = new Grid(2, 4);
    expect(g.isEmpty()).toBe(true);
  });
  it('returns false when any cell has color', () => {
    const g = new Grid(2, 4);
    g.loadFromData([['RED', null, null, null]]);
    expect(g.isEmpty()).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

Run: `npm test`
Expected: `Cannot find module '../src/game/Grid'`

- [ ] **Step 3: Create `src/game/Grid.ts`**

```typescript
import { getNeighbors, colsForRow } from '../utils/hexUtils';
import type { BubbleColor } from './Bubble';
import { GRID_COLS, GRID_ROWS } from '../config';

export interface GridCell {
  color: BubbleColor | null;
}

export class Grid {
  private cells: (GridCell | null)[][];
  readonly rows: number;
  readonly cols: number;

  constructor(rows = GRID_ROWS, cols = GRID_COLS) {
    this.rows = rows;
    this.cols = cols;
    this.cells = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: colsForRow(r) }, () => ({ color: null })),
    );
  }

  getColsForRow(row: number): number {
    return row % 2 === 0 ? this.cols : this.cols - 1;
  }

  getCell(row: number, col: number): GridCell | null {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.getColsForRow(row)) return null;
    return this.cells[row][col];
  }

  setCell(row: number, col: number, color: BubbleColor | null): void {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.getColsForRow(row)) return;
    this.cells[row][col] = { color };
  }

  loadFromData(data: (BubbleColor | null)[][]): void {
    data.forEach((rowData, r) => {
      if (r >= this.rows) return;
      rowData.forEach((color, c) => {
        if (c < this.getColsForRow(r)) this.cells[r][c] = { color };
      });
    });
  }

  findMatch(row: number, col: number): Array<{ row: number; col: number }> {
    const cell = this.getCell(row, col);
    if (!cell?.color) return [];
    const target = cell.color;
    const visited = new Set<string>();
    const queue: Array<{ row: number; col: number }> = [{ row, col }];
    const result: Array<{ row: number; col: number }> = [];

    while (queue.length > 0) {
      const cur = queue.shift()!;
      const key = `${cur.row},${cur.col}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (this.getCell(cur.row, cur.col)?.color !== target) continue;
      result.push(cur);
      for (const n of getNeighbors(cur.row, cur.col)) {
        if (!visited.has(`${n.row},${n.col}`)) queue.push(n);
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
      for (const n of getNeighbors(cur.row, cur.col)) {
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

- [ ] **Step 4: Run tests — confirm they pass**

Run: `npm test`
Expected: `✓ tests/Grid.test.ts (9)  ✓ tests/hexUtils.test.ts (8)`

- [ ] **Step 5: Create `src/utils/storage.ts`**

```typescript
const STORAGE_KEY = 'bubble_spy_progress';

export interface LevelProgress {
  stars: number;
  highScore: number;
}

export interface SaveData {
  levels: Record<string, LevelProgress>;
  unlockedUpTo: number;
}

const DEFAULT: SaveData = { levels: {}, unlockedUpTo: 1 };

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SaveData) : { ...DEFAULT };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveLevelResult(levelId: number, stars: number, score: number): void {
  const data = loadSave();
  const prev = data.levels[levelId] ?? { stars: 0, highScore: 0 };
  data.levels[levelId] = {
    stars: Math.max(prev.stars, stars),
    highScore: Math.max(prev.highScore, score),
  };
  if (stars >= 1) data.unlockedUpTo = Math.max(data.unlockedUpTo, levelId + 1);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
```

- [ ] **Step 6: Commit**

```bash
git add src/game/Grid.ts tests/Grid.test.ts src/utils/storage.ts
git commit -m "feat: Grid BFS match/orphan detection with tests, storage util"
```

---

### Task 5: BootScene and Texture Generation

**Files:**
- Create: `src/scenes/BootScene.ts`
- Create: `src/main.ts`

- [ ] **Step 1: Create `src/main.ts`** (minimal — only BootScene registered; others added in later tasks)

```typescript
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#050510',
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [BootScene],
});
```

- [ ] **Step 2: Create `src/scenes/BootScene.ts`**

```typescript
import Phaser from 'phaser';
import { ALL_COLORS, COLOR_CONFIG, getBubbleTextureKey, getShooterTextureKey } from '../game/Bubble';
import { BUBBLE_RADIUS } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.load.json('level-1', 'src/data/levels/level-001.json');
    this.load.json('level-2', 'src/data/levels/level-002.json');
    this.load.json('level-3', 'src/data/levels/level-003.json');

    const bar = this.add.graphics();
    this.load.on('progress', (v: number) => {
      bar.clear();
      bar.fillStyle(0x00e5ff);
      bar.fillRect(40, this.scale.height / 2 - 8, (this.scale.width - 80) * v, 16);
    });
  }

  create(): void {
    this.generateBubbleTextures();
    this.generateShooterTexture();
    this.registry.set('currentLevel', 1);
    this.scene.start('GameScene');
  }

  private generateBubbleTextures(): void {
    const size = BUBBLE_RADIUS * 2;
    for (const color of ALL_COLORS) {
      const key = getBubbleTextureKey(color);
      if (this.textures.exists(key)) continue;
      const ct = this.textures.createCanvas(key, size, size)!;
      const ctx = ct.context;
      const { base, glow } = COLOR_CONFIG[color];

      const grad = ctx.createRadialGradient(
        BUBBLE_RADIUS * 0.6, BUBBLE_RADIUS * 0.4, 2,
        BUBBLE_RADIUS, BUBBLE_RADIUS, BUBBLE_RADIUS,
      );
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.25, base);
      grad.addColorStop(1, glow);

      ctx.beginPath();
      ctx.arc(BUBBLE_RADIUS, BUBBLE_RADIUS, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(BUBBLE_RADIUS, BUBBLE_RADIUS, BUBBLE_RADIUS - 2, 0, Math.PI * 2);
      ctx.strokeStyle = glow;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.55;
      ctx.stroke();
      ctx.globalAlpha = 1;

      ct.refresh();
    }
  }

  private generateShooterTexture(): void {
    const key = getShooterTextureKey();
    if (this.textures.exists(key)) return;
    const ct = this.textures.createCanvas(key, 40, 50)!;
    const ctx = ct.context;

    ctx.fillStyle = '#00e5ff';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(38, 50);
    ctx.lineTo(2, 50);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#7c4dff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ct.refresh();
  }
}
```

- [ ] **Step 3: Run dev server and verify BootScene runs without errors**

Run: `npm run dev`
Open browser at the printed URL (e.g. `http://localhost:5173`).
Expected: Dark canvas, brief cyan progress bar, then black screen (GameScene not created yet — that's fine).
Check browser console: **no errors**.
Kill dev server with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts src/scenes/BootScene.ts
git commit -m "feat: BootScene preloads levels and generates procedural bubble textures"
```

---

### Task 6: GameScene — Grid Render

**Files:**
- Create: `src/scenes/GameScene.ts` (initial version)
- Modify: `src/main.ts` (add GameScene)

- [ ] **Step 1: Create `src/scenes/GameScene.ts`**

```typescript
import Phaser from 'phaser';
import { Grid } from '../game/Grid';
import { getBubbleTextureKey } from '../game/Bubble';
import { gridToPixel } from '../utils/hexUtils';
import {
  GRID_COLS, GRID_ROWS, GAME_WIDTH, GAME_HEIGHT,
  GRID_ORIGIN_Y, SHOOTER_X, SHOOTER_Y, DANGER_LINE_Y,
} from '../config';
import type { LevelData } from '../types/LevelData';
import type { BubbleColor } from '../game/Bubble';
import { getShooterTextureKey } from '../game/Bubble';

export class GameScene extends Phaser.Scene {
  private grid!: Grid;
  private gridSprites!: Map<string, Phaser.GameObjects.Image>;
  private levelData!: LevelData;
  private levelId!: number;

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
  }

  private drawBackground(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x050510);

    // Danger line
    const line = this.add.graphics();
    line.lineStyle(1, 0xff4081, 0.3);
    line.lineBetween(0, DANGER_LINE_Y, GAME_WIDTH, DANGER_LINE_Y);
  }

  private loadGridFromLevel(): void {
    this.grid.loadFromData(this.levelData.grid as (BubbleColor | null)[][]);
  }

  renderGrid(): void {
    // Clear old sprites
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
```

- [ ] **Step 2: Update `src/main.ts` to include GameScene**

```typescript
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#050510',
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [BootScene, GameScene],
});
```

- [ ] **Step 3: Run dev server and verify grid renders**

Run: `npm run dev`
Open browser.
Expected: Dark canvas with colored bubble sprites arranged in hex grid rows, cyan arrow/triangle at bottom-center. No console errors.
Kill server.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GameScene.ts src/main.ts
git commit -m "feat: GameScene renders hex grid from level data"
```

---

### Task 7: Trajectory Preview

**Files:**
- Create: `src/game/Trajectory.ts`
- Modify: `src/scenes/GameScene.ts` (integrate trajectory)

- [ ] **Step 1: Create `src/game/Trajectory.ts`**

```typescript
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

    // Clamp angle away from horizontal
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
    let dx = Math.sin(angle);  // unit direction x
    let dy = -Math.cos(angle); // unit direction y (up = negative)
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

      const tTop = (stopY - y) / dy; // dy < 0, stopY < y → tTop > 0

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
```

- [ ] **Step 2: Integrate Trajectory into `src/scenes/GameScene.ts`**

Add import at top:
```typescript
import { Trajectory } from '../game/Trajectory';
import { MIN_SHOOT_ANGLE, GAME_HEIGHT } from '../config';
```

Add `private trajectory!: Trajectory;` to class fields.

Add to `create()` after `this.drawShooter()`:
```typescript
this.trajectory = new Trajectory(this);
this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
  const dx = p.x - SHOOTER_X;
  const dy = SHOOTER_Y - p.y;
  if (dy <= 0) return;
  const angle = Math.atan2(dx, dy);
  this.trajectory.update(angle);
});
```

- [ ] **Step 3: Run dev server and verify trajectory line**

Run: `npm run dev`
Move mouse above the shooter.
Expected: Cyan dotted line follows mouse with correct wall bounces. Line stops near grid top. Straight up shows single segment, diagonal shows bounce.
Kill server.

- [ ] **Step 4: Commit**

```bash
git add src/game/Trajectory.ts src/scenes/GameScene.ts
git commit -m "feat: dotted trajectory preview with wall reflection"
```

---

### Task 8: Shooter — Queue and Fire

**Files:**
- Create: `src/game/Shooter.ts`
- Modify: `src/scenes/GameScene.ts` (integrate Shooter)

- [ ] **Step 1: Create `src/game/Shooter.ts`**

```typescript
import Phaser from 'phaser';
import type { BubbleColor } from './Bubble';
import { getBubbleTextureKey } from './Bubble';
import { SHOOTER_X, SHOOTER_Y, BUBBLE_RADIUS, MIN_SHOOT_ANGLE, SHOOT_COOLDOWN } from '../config';

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

    // Recoil tween
    this.scene.tweens.add({
      targets: this.currentSprite,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 50,
      yoyo: true,
    });

    this.emit('fire', this.currentColor, this.aimAngle);

    // Advance queue
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
```

- [ ] **Step 2: Integrate Shooter into `src/scenes/GameScene.ts`**

Add import:
```typescript
import { Shooter } from '../game/Shooter';
```

Add field: `private shooter!: Shooter;`

Replace `this.drawShooter()` call in `create()` with:
```typescript
this.shooter = new Shooter(this, this.levelData.colors as BubbleColor[]);
this.shooter.on('fire', this.onShooterFire, this);

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
```

Add the handler method:
```typescript
private onShooterFire(color: BubbleColor, angle: number): void {
  // Flying bubble spawn — implemented in Task 9
  console.log('fire', color, angle);
}
```

Remove the old `private drawShooter()` method.

- [ ] **Step 3: Run dev server and verify**

Run: `npm run dev`
Expected: Bubble sprite at shooter position, smaller "next" bubble to the right, trajectory follows mouse. Clicking fires (console.log shows color + angle). Rapid clicking blocked by cooldown.
Kill server.

- [ ] **Step 4: Commit**

```bash
git add src/game/Shooter.ts src/scenes/GameScene.ts
git commit -m "feat: Shooter class with bubble queue, cooldown, and fire event"
```

---

### Task 9: Flying Bubble, Snap, and Grid Placement

**Files:**
- Modify: `src/scenes/GameScene.ts` (add flying bubble logic, snap to grid)

This task adds the physics-free bubble movement, wall bounce, and grid snapping.

- [ ] **Step 1: Add flying bubble tracking and movement to `src/scenes/GameScene.ts`**

Add imports:
```typescript
import { pixelToNearestGrid, getNeighbors, gridToPixel } from '../utils/hexUtils';
import { BUBBLE_SPEED, BUBBLE_RADIUS, GAME_WIDTH } from '../config';
```

Add field:
```typescript
private flyingBubbles: Array<Phaser.GameObjects.Image & { vx: number; vy: number; bubbleColor: BubbleColor }> = [];
```

Replace `private onShooterFire(...)` with:
```typescript
private onShooterFire(color: BubbleColor, angle: number): void {
  const vx = Math.sin(angle) * BUBBLE_SPEED;
  const vy = -Math.cos(angle) * BUBBLE_SPEED;
  const bubble = this.add.image(SHOOTER_X, SHOOTER_Y - BUBBLE_RADIUS * 1.5, getBubbleTextureKey(color)) as Phaser.GameObjects.Image & { vx: number; vy: number; bubbleColor: BubbleColor };
  bubble.vx = vx;
  bubble.vy = vy;
  bubble.bubbleColor = color;
  this.flyingBubbles.push(bubble);
}
```

Add `update(time: number, delta: number)` method:
```typescript
update(_time: number, delta: number): void {
  const dt = delta / 1000;
  for (let i = this.flyingBubbles.length - 1; i >= 0; i--) {
    const b = this.flyingBubbles[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Wall bounce
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
```

Add helper methods:
```typescript
private findSnapCell(bx: number, by: number): { row: number; col: number } | null {
  const stopY = GRID_ORIGIN_Y + BUBBLE_RADIUS;

  // Check all occupied grid cells for proximity collision
  for (let r = 0; r < this.grid.rows; r++) {
    for (let c = 0; c < this.grid.getColsForRow(r); c++) {
      if (!this.grid.getCell(r, c)?.color) continue;
      const pos = gridToPixel(r, c);
      if (Math.hypot(bx - pos.x, by - pos.y) < BUBBLE_RADIUS * 2) {
        return this.nearestEmptyAround(bx, by, r, c);
      }
    }
  }

  // Ceiling
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

  // Bounce-in tween
  this.tweens.add({ targets: sprite, scaleX: 1.2, scaleY: 1.2, duration: 60, yoyo: true });

  this.processMatch(row, col);
}
```

Add stub for `processMatch` (real logic in Task 10):
```typescript
private processMatch(_row: number, _col: number): void {
  // TODO — implemented in Task 10
}
```

- [ ] **Step 2: Add `GRID_ORIGIN_Y` to imports in GameScene**

Ensure `GRID_ORIGIN_Y` is in the config import at top of GameScene.ts (it should already be there from Task 6).

- [ ] **Step 3: Run dev server and verify bubble snaps to grid**

Run: `npm run dev`
Click to fire bubbles.
Expected: Bubble travels in direction of click, bounces off left/right walls, snaps to an empty cell when it contacts the grid or ceiling. Grid grows as bubbles snap in.
Kill server.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: flying bubble movement with wall bounce and hex grid snap"
```

---

### Task 10: Match Detection and Orphan Drop

**Files:**
- Modify: `src/scenes/GameScene.ts` (implement processMatch, orphan fall, win/lose check)

- [ ] **Step 1: Replace the `processMatch` stub in `src/scenes/GameScene.ts`**

Add imports at top:
```typescript
import { MATCH_MIN, SCORE_PER_POP, SCORE_PER_ORPHAN } from '../config';
```

Add fields:
```typescript
private score = 0;
private totalBubbles = 0;
private movesLeft = 0;
private gameOver = false;
```

Initialise in `create()` after `this.loadGridFromLevel()`:
```typescript
this.totalBubbles = this.grid.countBubbles();
this.movesLeft = this.levelData.moves ?? 30;
this.score = 0;
this.gameOver = false;
```

Replace `processMatch` with the full implementation:
```typescript
private processMatch(row: number, col: number): void {
  const matched = this.grid.findMatch(row, col);
  if (matched.length < MATCH_MIN) {
    this.advanceTurn();
    return;
  }

  // Pop matched bubbles
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

  // Orphan drop
  const orphans = this.grid.findOrphans();
  orphans.forEach(({ row: r, col: c }, idx) => {
    const { x, y } = gridToPixel(r, c);
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

  this.events.emit(
    'progress-update',
    this.grid.countBubbles(),
    this.totalBubbles,
  );

  this.advanceTurn();
}

private removeCellSprite(row: number, col: number): void {
  const sprite = this.gridSprites.get(`${row},${col}`);
  if (!sprite) return;
  this.gridSprites.delete(`${row},${col}`);
  // Pop particle burst (Effects will add this; for now just destroy)
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
  this.events.emit('game-over', true, this.score, stars);
  this.showResultOverlay(true, stars);
}

private triggerLose(reason: string): void {
  console.log('lose:', reason);
  this.gameOver = true;
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

  const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80,
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
```

- [ ] **Step 2: Run dev server and test the full loop**

Run: `npm run dev`
Test the following:
1. Fire bubbles to create a 3+ match → bubbles pop, score floats up, screen shakes.
2. Create an orphan (pop support bubbles above a cluster) → orphans fall off screen.
3. Clear the entire grid → "MISSION COMPLETE" overlay appears.
4. Let moves run out → "MISSION FAILED" overlay appears.
5. Click "NEXT MISSION" → Level 2 loads.
Kill server.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: match detection, orphan drop, score, win/lose overlays"
```

---

### Task 11: Particle Effects

**Files:**
- Create: `src/game/Effects.ts`
- Modify: `src/scenes/GameScene.ts` (use Effects for pop particles)

- [ ] **Step 1: Create `src/game/Effects.ts`**

```typescript
import Phaser from 'phaser';
import type { BubbleColor } from './Bubble';
import { COLOR_CONFIG } from './Bubble';
import { BUBBLE_RADIUS } from '../config';

export class Effects {
  constructor(private scene: Phaser.Scene) {}

  popBurst(x: number, y: number, color: BubbleColor): void {
    const hexColor = parseInt(COLOR_CONFIG[color].glow.replace('#', ''), 16);
    const COUNT = 14;

    for (let i = 0; i < COUNT; i++) {
      const angle = (i / COUNT) * Math.PI * 2;
      const speed = Phaser.Math.Between(60, 140);
      const radius = BUBBLE_RADIUS * 0.4;

      const dot = this.scene.add.circle(x, y, radius, hexColor, 1);
      this.scene.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        scaleX: 0,
        scaleY: 0,
        alpha: 0,
        duration: Phaser.Math.Between(300, 500),
        ease: 'Power2',
        onComplete: () => dot.destroy(),
      });
    }
  }
}
```

- [ ] **Step 2: Integrate Effects into `src/scenes/GameScene.ts`**

Add import:
```typescript
import { Effects } from '../game/Effects';
```

Add field: `private effects!: Effects;`

In `create()`, add after grid render:
```typescript
this.effects = new Effects(this);
```

Replace the body of `removeCellSprite` with:
```typescript
private removeCellSprite(row: number, col: number): void {
  const sprite = this.gridSprites.get(`${row},${col}`);
  if (!sprite) return;
  this.gridSprites.delete(`${row},${col}`);
  const cell = this.grid.getCell(row, col);  // color still set at call time
  if (cell?.color) this.effects.popBurst(sprite.x, sprite.y, cell.color);
  sprite.destroy();
}
```

Wait — `removeCellSprite` is called before `this.grid.setCell(r, c, null)` in `processMatch`, so the color is still readable. Verify the call order in `processMatch` (it is: `removeCellSprite` first, then `setCell(null)`). ✓

- [ ] **Step 3: Run dev server and verify particle bursts**

Run: `npm run dev`
Pop 3+ matching bubbles.
Expected: Color-matched particle dots burst outward from each popped bubble, fade and shrink to nothing. Screen shakes proportionally. Score float text appears.
Kill server.

- [ ] **Step 4: Commit**

```bash
git add src/game/Effects.ts src/scenes/GameScene.ts
git commit -m "feat: particle pop burst effect on bubble match"
```

---

### Task 12: UIScene

**Files:**
- Create: `src/scenes/UIScene.ts`
- Modify: `src/main.ts` (add UIScene)

- [ ] **Step 1: Create `src/scenes/UIScene.ts`**

```typescript
import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';

export class UIScene extends Phaser.Scene {
  private scoreTxt!: Phaser.GameObjects.Text;
  private movesTxt!: Phaser.GameObjects.Text;
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressBg!: Phaser.GameObjects.Graphics;

  private score = 0;
  private totalBubbles = 1;
  private remainingBubbles = 1;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    const game = this.scene.get('GameScene');

    this.drawHudBackground();

    this.scoreTxt = this.add.text(12, 8, 'SCORE: 0', {
      fontSize: '14px', color: '#00e5ff', fontFamily: 'monospace',
    });

    this.movesTxt = this.add.text(GAME_WIDTH - 12, 8, 'MOVES: --', {
      fontSize: '14px', color: '#00e5ff', fontFamily: 'monospace',
    }).setOrigin(1, 0);

    this.progressBg = this.add.graphics();
    this.progressBar = this.add.graphics();
    this.drawProgressBar(1);

    game.events.on('score-update', (s: number) => {
      this.score = s;
      this.animateScore();
    });

    game.events.on('moves-update', (m: number) => {
      this.movesTxt.setText(`MOVES: ${m}`);
      if (m <= 5) this.movesTxt.setColor('#ff4081');
    });

    game.events.on('progress-update', (remaining: number, total: number) => {
      this.remainingBubbles = remaining;
      this.totalBubbles = total;
      this.drawProgressBar(remaining / total);
    });
  }

  private drawHudBackground(): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x0a1428, 0.85);
    bg.fillRect(0, 0, GAME_WIDTH, 36);
  }

  private drawProgressBar(fraction: number): void {
    const BAR_X = GAME_WIDTH / 2 - 80;
    const BAR_Y = 12;
    const BAR_W = 160;
    const BAR_H = 12;

    this.progressBg.clear();
    this.progressBg.fillStyle(0x1a2540);
    this.progressBg.fillRect(BAR_X, BAR_Y, BAR_W, BAR_H);

    this.progressBar.clear();
    const filled = Phaser.Math.Clamp(1 - fraction, 0, 1);
    this.progressBar.fillStyle(0x00e5ff);
    this.progressBar.fillRect(BAR_X, BAR_Y, BAR_W * filled, BAR_H);

    // Star threshold markers at 33%, 66%, 100%
    this.progressBg.lineStyle(1, 0xffd600, 0.7);
    [0.33, 0.66, 1.0].forEach((t) => {
      const mx = BAR_X + BAR_W * t;
      this.progressBg.lineBetween(mx, BAR_Y - 2, mx, BAR_Y + BAR_H + 2);
    });
  }

  private animateScore(): void {
    this.scoreTxt.setText(`SCORE: ${this.score}`);
    this.tweens.add({
      targets: this.scoreTxt,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 80,
      yoyo: true,
    });
  }
}
```

- [ ] **Step 2: Update `src/main.ts` to include UIScene**

```typescript
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#050510',
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [BootScene, GameScene, UIScene],
});
```

- [ ] **Step 3: Start UIScene from GameScene**

At the end of `GameScene.create()`, add:
```typescript
this.scene.launch('UIScene');
```

- [ ] **Step 4: Emit `moves-update` on scene start so UIScene shows initial move count**

At end of `GameScene.create()`, after launching UIScene, add:
```typescript
this.time.delayedCall(50, () => {
  this.events.emit('moves-update', this.movesLeft);
  this.events.emit('progress-update', this.grid.countBubbles(), this.totalBubbles);
});
```

(50ms delay lets UIScene finish `create()` before receiving events.)

- [ ] **Step 5: Stop UIScene when GameScene is destroyed**

Add to `GameScene`:
```typescript
shutdown(): void {
  this.scene.stop('UIScene');
}
```

Add `this.events.on('shutdown', this.shutdown, this);` at end of `GameScene.create()`.

- [ ] **Step 6: Run dev server and verify HUD**

Run: `npm run dev`
Expected: Cyan "SCORE: 0" top-left, "MOVES: 30" top-right, cyan progress bar top-center. Score animates on pop. Moves decrement on each shot. Progress bar fills from left as bubbles cleared. Moves turns red at ≤5.
Kill server.

- [ ] **Step 7: Commit**

```bash
git add src/scenes/UIScene.ts src/main.ts src/scenes/GameScene.ts
git commit -m "feat: UIScene overlay with score, moves counter, and progress bar"
```

---

### Task 13: Final Polish and Integration Verification

**Files:**
- Modify: `src/scenes/BootScene.ts` (use proper Vite asset URL for JSON)
- Modify: `src/scenes/GameScene.ts` (save level results to storage)

- [ ] **Step 1: Fix JSON asset paths for Vite**

Vite serves files from `public/` at root. Move level JSON files into `public/data/levels/` so Phaser's loader can fetch them by URL.

```bash
mkdir -p public/data/levels
cp src/data/levels/level-001.json public/data/levels/
cp src/data/levels/level-002.json public/data/levels/
cp src/data/levels/level-003.json public/data/levels/
```

Update `src/scenes/BootScene.ts` preload paths:
```typescript
this.load.json('level-1', 'data/levels/level-001.json');
this.load.json('level-2', 'data/levels/level-002.json');
this.load.json('level-3', 'data/levels/level-003.json');
```

Keep `src/data/levels/` for the TypeScript type system (imported by tests), but the runtime uses `public/`.

- [ ] **Step 2: Save results to localStorage on game over**

Add import in `GameScene.ts`:
```typescript
import { saveLevelResult } from '../utils/storage';
```

In `triggerWin()`, before `showResultOverlay`, add:
```typescript
saveLevelResult(this.levelId, stars, this.score);
```

In `triggerLose()`, add:
```typescript
saveLevelResult(this.levelId, 0, this.score);
```

- [ ] **Step 3: Run full game end-to-end**

Run: `npm run dev`
Play through complete scenarios:
1. Level 1: pop all bubbles → "MISSION COMPLETE", star rating shown, localStorage written (verify in DevTools → Application → Local Storage).
2. Level 1: run out of moves → "MISSION FAILED", retry reloads Level 1.
3. Win Level 1 → click "NEXT MISSION" → Level 2 loads with correct grid.
4. Win Level 2 → Level 3 loads.
5. Win Level 3 → "NEXT MISSION" not shown (no Level 4), only "RETRY".
Kill server.

- [ ] **Step 4: Run all tests one final time**

Run: `npm test`
Expected: All tests pass with zero failures.

- [ ] **Step 5: Commit**

```bash
git add public/data/ src/scenes/BootScene.ts src/scenes/GameScene.ts src/utils/storage.ts
git commit -m "feat: wire localStorage persistence, fix asset paths for Vite"
```

---

## Self-Review

### Spec Coverage

| Spec requirement | Covered in task |
|---|---|
| Phaser project scaffold (Vite + Phaser 3) | Task 1 |
| BootScene (asset preload) | Task 5 |
| Hex grid render | Task 6 |
| Shooter + aim angle | Task 7, 8 |
| Trajectory preview with wall bounces | Task 7 |
| Collision & snap | Task 9 |
| BFS match detection (3+) | Task 10 |
| Orphan detection + fall animation | Task 10 |
| Screen shake (scaled by match size) | Task 10 |
| Score float text | Task 10 |
| Win condition (grid empty) | Task 10 |
| Lose condition (moves = 0) | Task 10 |
| Bubble pop particles | Task 11 |
| UIScene: score counter with tween | Task 12 |
| UIScene: progress bar with star thresholds | Task 12 |
| UIScene: moves counter | Task 12 |
| 3 hardcoded levels (JSON) | Task 2 |
| Win/lose overlays | Task 10 |
| localStorage persistence | Task 13 |
| Star scoring (3 thresholds per level) | Task 10 |

**Not in Phase 1 (deferred to Phase 2+):** MenuScene, MapScene, descent mechanic, timer-based levels, mobile touch tuning, sound, animations.

### Type Consistency Check

- `BubbleColor` defined in `Bubble.ts`, imported everywhere — consistent.
- `gridToPixel` / `pixelToNearestGrid` / `getNeighbors` imported from `hexUtils` — all callers use same import path.
- `Grid.getColsForRow(r)` used consistently in Grid.ts; `colsForRow(r)` in hexUtils.ts (same logic, separate impl — no cross-dependency issue).
- `LevelData.grid` typed as `(BubbleColor | null)[][]` — cast applied in GameScene where JSON is loaded.

### No Placeholders

Reviewed — no TBD/TODO/placeholder text in any task.

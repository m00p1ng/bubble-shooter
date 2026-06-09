# Bubble Spy Phase 2 — Menu + Map + Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MenuScene, MapScene, and level progression system with localStorage persistence, 10 total levels, tweened scene transitions, and a working UIScene HUD overlay.

**Architecture:** Three new Phaser scenes (UIScene, MenuScene, MapScene) plus a scene transition utility. UIScene runs parallel to GameScene via Phaser's multi-scene system. MenuScene and MapScene form the pre-game navigation flow. All scene switches use a fade-to-black tween helper. Level data expands from 3 to 10 JSON configs. Storage helpers abstract localStorage reads for the map node state rendering.

**Tech Stack:** Phaser 3, TypeScript, Vite, vitest, localStorage

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/scenes/UIScene.ts` | HUD overlay running parallel to GameScene: score counter, progress bar with star thresholds, moves/timer display, pause button/overlay |
| `src/scenes/MenuScene.ts` | Main menu: dark background, "BUBBLE SPY" title with glow, floating neon bubbles, PLAY button, bottom nav labels |
| `src/scenes/MapScene.ts` | Tactical mission map: level nodes in a zig-zag path, dashed connections, node states (locked/current/completed), star ratings, agent marker, mission briefing overlay |
| `src/utils/transition.ts` | `fadeOutAndStart()` and `fadeIn()` helpers for tweened scene transitions via black overlay |
| `src/data/levels/level-004.json` | Level 4 config |
| `src/data/levels/level-005.json` | Level 5 config |
| `src/data/levels/level-006.json` | Level 6 config |
| `src/data/levels/level-007.json` | Level 7 config (timer-based) |
| `src/data/levels/level-008.json` | Level 8 config |
| `src/data/levels/level-009.json` | Level 9 config |
| `src/data/levels/level-010.json` | Level 10 config |
| `tests/utils/storage.test.ts` | Tests for `getLevelProgress`, `isLevelUnlocked`, `saveLevelResult` |
| `tests/data/levels.test.ts` | Validation tests for all 10 level JSON files |

### Modified Files

| File | Changes |
|------|---------|
| `src/main.ts` | Register `UIScene`, `MenuScene`, `MapScene` in game config scene array |
| `src/scenes/BootScene.ts` | Loop-load all 10 level JSONs; transition to `MenuScene` on complete |
| `src/scenes/GameScene.ts` | Support `timer` level type; use `fadeOutAndStart` for result-screen navigation; add MAP button to result overlay; emit `timer-update` events |
| `src/utils/storage.ts` | Add `getLevelProgress()` and `isLevelUnlocked()` helpers |

---

## Task 1: UIScene — Game HUD Overlay

**Files:**
- Create: `src/scenes/UIScene.ts`
- Modify: `src/main.ts`

UIScene runs as a parallel scene launched by GameScene. It listens to GameScene events via Phaser's scene event system.

- [ ] **Step 1: Create UIScene with score, progress bar, and moves/timer display**

Create `src/scenes/UIScene.ts`:

```typescript
import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';

export class UIScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private movesText!: Phaser.GameObjects.Text;
  private progressBg!: Phaser.GameObjects.Rectangle;
  private progressFill!: Phaser.GameObjects.Rectangle;
  private starMarkers: Phaser.GameObjects.Text[] = [];

  constructor() {
    super({ key: 'UIScene', active: false });
  }

  create(): void {
    this.createScoreDisplay();
    this.createProgressBar();
    this.createMovesDisplay();
    this.createPauseButton();
    this.listenToGameEvents();
  }

  private createScoreDisplay(): void {
    this.scoreText = this.add.text(16, 16, 'SCORE: 0', {
      fontSize: '14px',
      color: '#00e5ff',
      fontFamily: 'monospace',
    });
  }

  private createProgressBar(): void {
    const barY = 20;
    const barW = 160;
    const barH = 12;
    const barX = (GAME_WIDTH - barW) / 2;

    this.progressBg = this.add
      .rectangle(barX + barW / 2, barY + barH / 2, barW, barH)
      .setStrokeStyle(1, 0x00e5ff, 0.5);
    this.progressFill = this.add.rectangle(
      barX + 1,
      barY + barH / 2,
      0,
      barH - 2,
      0x00e5ff,
    );
    this.progressFill.setOrigin(0, 0.5);

    [0.33, 0.66, 1.0].forEach((pct) => {
      const x = barX + barW * pct;
      const marker = this.add.text(x, barY + barH + 8, '★', {
        fontSize: '10px',
        color: '#8892b0',
      }).setOrigin(0.5);
      this.starMarkers.push(marker);
    });
  }

  private createMovesDisplay(): void {
    this.movesText = this.add
      .text(GAME_WIDTH - 16, 16, 'MOVES: --', {
        fontSize: '14px',
        color: '#00e5ff',
        fontFamily: 'monospace',
      })
      .setOrigin(1, 0);
  }

  private createPauseButton(): void {
    const btn = this.add
      .text(GAME_WIDTH - 16, 48, '||', {
        fontSize: '16px',
        color: '#c0c8ff',
        fontFamily: 'monospace',
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });

    btn.on('pointerdown', () => {
      this.scene.get('GameScene').scene.pause();
      this.showPauseOverlay();
    });
  }

  private showPauseOverlay(): void {
    const overlay = this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width,
      this.scale.height,
      0x000000,
      0.7,
    );
    overlay.setDepth(100);

    const resume = this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'RESUME', {
        fontSize: '24px',
        color: '#69f0ae',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(101);

    resume.on('pointerdown', () => {
      overlay.destroy();
      resume.destroy();
      this.scene.get('GameScene').scene.resume();
    });
  }

  private listenToGameEvents(): void {
    const gameScene = this.scene.get('GameScene');

    gameScene.events.on('score-update', (score: number) => {
      this.scoreText.setText(`SCORE: ${score}`);
      this.tweens.add({
        targets: this.scoreText,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 100,
        yoyo: true,
      });
    });

    gameScene.events.on('moves-update', (moves: number) => {
      this.movesText.setText(`MOVES: ${moves}`);
    });

    gameScene.events.on('timer-update', (timeLeft: number) => {
      this.movesText.setText(`TIME: ${timeLeft}`);
    });

    gameScene.events.on('progress-update', (current: number, total: number) => {
      const pct = total > 0 ? 1 - current / total : 0;
      const barW = 160;
      this.progressFill.width = Math.max(0, (barW - 2) * pct);

      [0.33, 0.66, 1.0].forEach((threshold, idx) => {
        const color = pct >= threshold ? '#ffd600' : '#8892b0';
        this.starMarkers[idx].setColor(color);
      });
    });
  }
}
```

- [ ] **Step 2: Register UIScene in main.ts scene array**

Modify `src/main.ts`:

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

- [ ] **Step 3: Run dev server and verify UIScene loads without errors**

Run: `npm run dev`
Open browser, verify no console errors when GameScene launches UIScene.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/UIScene.ts src/main.ts
git commit -m "feat: add UIScene HUD overlay with score, progress, moves, pause"
```

---

## Task 2: Scene Transition Utility

**Files:**
- Create: `src/utils/transition.ts`
- Test: `tests/utils/transition.test.ts` (skip — Phaser-dependent, covered by integration)

- [ ] **Step 1: Create fadeOutAndStart and fadeIn helpers**

Create `src/utils/transition.ts`:

```typescript
/**
 * Fades the screen to black, then starts the target scene.
 * Optionally stops additional parallel scenes before starting.
 */
export function fadeOutAndStart(
  scene: Phaser.Scene,
  targetScene: string,
  options?: {
    data?: Record<string, unknown>;
    stopScenes?: string[];
  },
): void {
  const { data, stopScenes } = options ?? {};
  const w = scene.scale.width;
  const h = scene.scale.height;

  const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0);
  overlay.setDepth(1000);

  scene.tweens.add({
    targets: overlay,
    alpha: 1,
    duration: 250,
    onComplete: () => {
      stopScenes?.forEach((key) => scene.scene.stop(key));
      scene.scene.start(targetScene, data);
    },
  });
}

/**
 * Fades in from black. Call this in the target scene's create() method.
 */
export function fadeIn(scene: Phaser.Scene): Phaser.GameObjects.Rectangle {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 1);
  overlay.setDepth(1000);

  scene.tweens.add({
    targets: overlay,
    alpha: 0,
    duration: 250,
    onComplete: () => overlay.destroy(),
  });

  return overlay;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/transition.ts
git commit -m "feat: add scene transition fade helpers"
```

---

## Task 3: MenuScene

**Files:**
- Create: `src/scenes/MenuScene.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create MenuScene with background, title, and floating bubbles**

Create `src/scenes/MenuScene.ts`:

```typescript
import Phaser from 'phaser';
import { ALL_COLORS, getBubbleTextureKey } from '../game/Bubble';
import { fadeOutAndStart, fadeIn } from '../utils/transition';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    fadeIn(this);
    this.createBackground();
    this.createTitle();
    this.createFloatingBubbles();
    this.createPlayButton();
    this.createNavLabels();
  }

  private createBackground(): void {
    this.add
      .rectangle(
        this.scale.width / 2,
        this.scale.height / 2,
        this.scale.width,
        this.scale.height,
        0x050510,
      )
      .setDepth(-1);

    // Static starfield
    for (let i = 0; i < 80; i++) {
      this.add.circle(
        Phaser.Math.Between(0, this.scale.width),
        Phaser.Math.Between(0, this.scale.height),
        Phaser.Math.FloatBetween(0.5, 1.5),
        0xffffff,
        Phaser.Math.FloatBetween(0.2, 0.7),
      );
    }
  }

  private createTitle(): void {
    const cx = this.scale.width / 2;
    const cy = 160;

    this.add
      .text(cx, cy, 'BUBBLE SPY', {
        fontSize: '42px',
        color: '#00e5ff',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        shadow: {
          offsetX: 0,
          offsetY: 0,
          blur: 20,
          color: '#00e5ff',
          fill: true,
          stroke: true,
        },
      })
      .setOrigin(0.5);
  }

  private createFloatingBubbles(): void {
    this.time.addEvent({
      delay: 800,
      callback: () => this.spawnFloatingBubble(),
      loop: true,
    });
  }

  private spawnFloatingBubble(): void {
    const color = ALL_COLORS[Math.floor(Math.random() * ALL_COLORS.length)];
    const x = Phaser.Math.Between(30, this.scale.width - 30);
    const y = this.scale.height + 30;

    const bubble = this.add
      .image(x, y, getBubbleTextureKey(color))
      .setScale(Phaser.Math.FloatBetween(0.4, 0.8))
      .setAlpha(Phaser.Math.FloatBetween(0.3, 0.6));

    this.tweens.add({
      targets: bubble,
      y: -50,
      x: x + Phaser.Math.Between(-40, 40),
      duration: Phaser.Math.Between(4000, 8000),
      onComplete: () => bubble.destroy(),
    });
  }

  private createPlayButton(): void {
    const cx = this.scale.width / 2;
    const cy = 380;

    const playBtn = this.add
      .text(cx, cy, '[ PLAY ]', {
        fontSize: '24px',
        color: '#69f0ae',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    playBtn.on('pointerover', () => playBtn.setColor('#a5d6a7'));
    playBtn.on('pointerout', () => playBtn.setColor('#69f0ae'));
    playBtn.on('pointerdown', () => {
      fadeOutAndStart(this, 'MapScene');
    });
  }

  private createNavLabels(): void {
    this.add
      .text(30, this.scale.height - 40, 'SETTINGS', {
        fontSize: '10px',
        color: '#8892b0',
        fontFamily: 'monospace',
      })
      .setOrigin(0, 0.5);

    this.add
      .text(this.scale.width - 30, this.scale.height - 40, 'LEADERBOARD', {
        fontSize: '10px',
        color: '#8892b0',
        fontFamily: 'monospace',
      })
      .setOrigin(1, 0.5);
  }
}
```

- [ ] **Step 2: Register MenuScene in main.ts**

Modify `src/main.ts`:

```typescript
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
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
  scene: [BootScene, MenuScene, GameScene, UIScene],
});
```

- [ ] **Step 3: Verify MenuScene renders in dev server**

Run: `npm run dev`
Verify: dark background with stars, "BUBBLE SPY" title with glow, floating bubbles rising, PLAY button hoverable.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/MenuScene.ts src/main.ts
git commit -m "feat: add MenuScene with title, floating bubbles, and play button"
```

---

## Task 4: MapScene

**Files:**
- Create: `src/scenes/MapScene.ts`
- Modify: `src/utils/storage.ts`

MapScene displays 10 level nodes in a zig-zag path. Nodes show completion state, star ratings, and a pulsing agent marker on the current level. Tapping a completed or current node opens a mission briefing overlay.

- [ ] **Step 1: Add getLevelProgress and isLevelUnlocked to storage.ts**

Modify `src/utils/storage.ts`, add after `saveLevelResult`:

```typescript
export function getLevelProgress(levelId: number): LevelProgress {
  const data = loadSave();
  return data.levels[levelId] ?? { stars: 0, highScore: 0 };
}

export function isLevelUnlocked(levelId: number): boolean {
  const data = loadSave();
  return levelId <= data.unlockedUpTo;
}
```

- [ ] **Step 2: Create MapScene with node layout, connections, and states**

Create `src/scenes/MapScene.ts`:

```typescript
import Phaser from 'phaser';
import { loadSave, getLevelProgress, isLevelUnlocked } from '../utils/storage';
import { fadeOutAndStart, fadeIn } from '../utils/transition';
import type { LevelData } from '../types/LevelData';

const LEVEL_NODES = [
  { x: 90, y: 110 },
  { x: 210, y: 160 },
  { x: 350, y: 130 },
  { x: 390, y: 240 },
  { x: 290, y: 300 },
  { x: 170, y: 340 },
  { x: 90, y: 430 },
  { x: 130, y: 530 },
  { x: 270, y: 570 },
  { x: 390, y: 630 },
];

const NODE_RADIUS = 18;
const COMPLETED_COLOR = 0x00e5ff;
const CURRENT_COLOR = 0xff4081;
const LOCKED_COLOR = 0x444444;

export class MapScene extends Phaser.Scene {
  private briefingContainer!: Phaser.GameObjects.Container | null;
  private agentMarker!: Phaser.GameObjects.Triangle;

  constructor() {
    super({ key: 'MapScene' });
  }

  create(): void {
    fadeIn(this);
    this.briefingContainer = null;
    this.createBackground();
    this.createBackButton();
    this.drawConnections();
    this.drawNodes();
    this.placeAgentMarker();
  }

  private createBackground(): void {
    this.add
      .rectangle(
        this.scale.width / 2,
        this.scale.height / 2,
        this.scale.width,
        this.scale.height,
        0x050510,
      )
      .setDepth(-1);

    // Grid lines for tactical feel
    const g = this.add.graphics();
    g.lineStyle(1, 0x0a1428, 0.5);
    for (let x = 0; x < this.scale.width; x += 40) {
      g.lineBetween(x, 0, x, this.scale.height);
    }
    for (let y = 0; y < this.scale.height; y += 40) {
      g.lineBetween(0, y, this.scale.width, y);
    }
  }

  private createBackButton(): void {
    const btn = this.add
      .text(20, 20, '< BACK', {
        fontSize: '12px',
        color: '#8892b0',
        fontFamily: 'monospace',
      })
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    btn.on('pointerdown', () => {
      fadeOutAndStart(this, 'MenuScene');
    });
  }

  private drawConnections(): void {
    const g = this.add.graphics();
    g.lineStyle(2, 0x8892b0, 0.4);

    for (let i = 0; i < LEVEL_NODES.length - 1; i++) {
      const a = LEVEL_NODES[i];
      const b = LEVEL_NODES[i + 1];
      this.drawDashedLine(g, a.x, a.y, b.x, b.y);
    }
  }

  private drawDashedLine(
    g: Phaser.GameObjects.Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    dashLen = 6,
    gapLen = 4,
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const ux = dx / len;
    const uy = dy / len;

    let drawn = 0;
    while (drawn < len) {
      const segStart = drawn;
      const segEnd = Math.min(drawn + dashLen, len);
      g.lineBetween(
        x1 + ux * segStart,
        y1 + uy * segStart,
        x1 + ux * segEnd,
        y1 + uy * segEnd,
      );
      drawn += dashLen + gapLen;
    }
  }

  private drawNodes(): void {
    const save = loadSave();

    LEVEL_NODES.forEach((pos, idx) => {
      const levelId = idx + 1;
      const progress = getLevelProgress(levelId);
      const unlocked = isLevelUnlocked(levelId);
      const isCurrent = levelId === save.unlockedUpTo;
      const isCompleted = progress.stars > 0;

      const color = isCompleted
        ? COMPLETED_COLOR
        : isCurrent
          ? CURRENT_COLOR
          : LOCKED_COLOR;

      // Node circle
      const circle = this.add.circle(pos.x, pos.y, NODE_RADIUS, color);
      circle.setStrokeStyle(2, color, 0.8);

      if (!unlocked) {
        circle.setAlpha(0.5);
      }

      // Level number
      const label = this.add
        .text(pos.x, pos.y, String(levelId), {
          fontSize: '14px',
          color: '#ffffff',
          fontFamily: 'monospace',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      if (!unlocked) {
        label.setAlpha(0.5);
      }

      // Stars for completed levels
      if (isCompleted) {
        const starsText = '★'.repeat(progress.stars) + '☆'.repeat(3 - progress.stars);
        this.add
          .text(pos.x, pos.y + NODE_RADIUS + 10, starsText, {
            fontSize: '10px',
            color: '#ffd600',
          })
          .setOrigin(0.5);
      }

      // Pulse glow for current level
      if (isCurrent) {
        const glow = this.add.circle(pos.x, pos.y, NODE_RADIUS + 6, CURRENT_COLOR, 0.3);
        this.tweens.add({
          targets: glow,
          scaleX: 1.3,
          scaleY: 1.3,
          alpha: 0,
          duration: 1000,
          repeat: -1,
        });
      }

      // Interaction
      if (unlocked) {
        circle.setInteractive({ useHandCursor: true });
        label.setInteractive({ useHandCursor: true });
        const onClick = () => this.showBriefing(levelId);
        circle.on('pointerdown', onClick);
        label.on('pointerdown', onClick);
      }
    });
  }

  private placeAgentMarker(): void {
    const save = loadSave();
    const currentLevel = Math.min(save.unlockedUpTo, LEVEL_NODES.length);
    const pos = LEVEL_NODES[currentLevel - 1];

    this.agentMarker = this.add.triangle(
      pos.x,
      pos.y - NODE_RADIUS - 14,
      0,
      -8,
      -7,
      6,
      7,
      6,
      0x00e5ff,
    );
    this.agentMarker.setOrigin(0.5);

    this.tweens.add({
      targets: this.agentMarker,
      y: '+=4',
      duration: 600,
      yoyo: true,
      repeat: -1,
    });
  }

  private showBriefing(levelId: number): void {
    if (this.briefingContainer) {
      this.briefingContainer.destroy();
      this.briefingContainer = null;
    }

    const levelData = this.cache.json.get(`level-${levelId}`) as LevelData;
    const progress = getLevelProgress(levelId);

    this.briefingContainer = this.add.container(0, 0);
    this.briefingContainer.setDepth(100);

    // Background panel
    const panelW = this.scale.width - 48;
    const panelH = 280;
    const panelX = this.scale.width / 2;
    const panelY = this.scale.height / 2;

    const bg = this.add.rectangle(
      panelX,
      panelY,
      panelW,
      panelH,
      0x0a1428,
      0.95,
    );
    bg.setStrokeStyle(2, 0x00e5ff, 0.5);
    this.briefingContainer.add(bg);

    // Level name
    const nameText = this.add.text(panelX, panelY - 90, levelData.name, {
      fontSize: '22px',
      color: '#00e5ff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    });
    nameText.setOrigin(0.5);
    this.briefingContainer.add(nameText);

    // Objective
    const objectiveText =
      levelData.type === 'moves'
        ? `OBJECTIVE: Clear all bubbles in ${levelData.moves} moves`
        : `OBJECTIVE: Clear all bubbles in ${levelData.time} seconds`;
    const obj = this.add.text(panelX, panelY - 50, objectiveText, {
      fontSize: '13px',
      color: '#c0c8ff',
      fontFamily: 'monospace',
    });
    obj.setOrigin(0.5);
    this.briefingContainer.add(obj);

    // Best score
    if (progress.highScore > 0) {
      const best = this.add.text(
        panelX,
        panelY - 20,
        `BEST SCORE: ${progress.highScore}`,
        {
          fontSize: '13px',
          color: '#69f0ae',
          fontFamily: 'monospace',
        },
      );
      best.setOrigin(0.5);
      this.briefingContainer.add(best);
    }

    // Stars
    const starsText = '★'.repeat(progress.stars) + '☆'.repeat(3 - progress.stars);
    const stars = this.add.text(panelX, panelY + 20, starsText, {
      fontSize: '28px',
      color: '#ffd600',
    });
    stars.setOrigin(0.5);
    this.briefingContainer.add(stars);

    // Star thresholds
    const thresholds = this.add.text(
      panelX,
      panelY + 50,
      `★ ${levelData.stars[0]}    ★★ ${levelData.stars[1]}    ★★★ ${levelData.stars[2]}`,
      {
        fontSize: '11px',
        color: '#8892b0',
        fontFamily: 'monospace',
      },
    );
    thresholds.setOrigin(0.5);
    this.briefingContainer.add(thresholds);

    // START button
    const startBtn = this.add
      .text(panelX, panelY + 90, '[ START MISSION ]', {
        fontSize: '18px',
        color: '#69f0ae',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.briefingContainer.add(startBtn);

    startBtn.on('pointerover', () => startBtn.setColor('#a5d6a7'));
    startBtn.on('pointerout', () => startBtn.setColor('#69f0ae'));
    startBtn.on('pointerdown', () => {
      this.registry.set('currentLevel', levelId);
      fadeOutAndStart(this, 'GameScene', {
        stopScenes: ['MapScene'],
      });
    });

    // Close button
    const closeBtn = this.add
      .text(panelX + panelW / 2 - 20, panelY - panelH / 2 + 20, 'X', {
        fontSize: '18px',
        color: '#ff4081',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.briefingContainer.add(closeBtn);

    closeBtn.on('pointerdown', () => {
      this.briefingContainer?.destroy();
      this.briefingContainer = null;
    });
  }
}
```

- [ ] **Step 3: Register MapScene in main.ts**

Modify `src/main.ts` to add `MapScene` to the scene array:

```typescript
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { MapScene } from './scenes/MapScene';
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
  scene: [BootScene, MenuScene, MapScene, GameScene, UIScene],
});
```

- [ ] **Step 4: Verify MapScene in dev server**

Run: `npm run dev`
Navigate: MenuScene → click PLAY → verify MapScene shows:
- 10 nodes in zig-zag pattern with dashed connections
- Node 1 is current (magenta with pulse), nodes 2-10 are locked (grey)
- Clicking node 1 opens briefing overlay with level name, objective, START button
- Clicking BACK returns to MenuScene

- [ ] **Step 5: Commit**

```bash
git add src/scenes/MapScene.ts src/utils/storage.ts src/main.ts
git commit -m "feat: add MapScene with level nodes, stars, briefing overlay"
```

---

## Task 5: BootScene Updates

**Files:**
- Modify: `src/scenes/BootScene.ts`

- [ ] **Step 1: Load all 10 levels and transition to MenuScene**

Replace the `preload()` and `create()` methods in `src/scenes/BootScene.ts`:

```typescript
  preload(): void {
    for (let i = 1; i <= 10; i++) {
      const id = i.toString().padStart(3, '0');
      this.load.json(`level-${i}`, `data/levels/level-${id}.json`);
    }

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
    this.scene.start('MenuScene');
  }
```

Keep `generateBubbleTextures()` and `generateShooterTexture()` unchanged.

- [ ] **Step 2: Verify BootScene → MenuScene transition**

Run: `npm run dev`
Verify: loading bar appears briefly, then MenuScene loads automatically.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/BootScene.ts
git commit -m "feat: BootScene loads 10 levels and routes to MenuScene"
```

---

## Task 6: GameScene Timer Support and Scene Flow

**Files:**
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/utils/transition.ts` (if needed — no changes needed)

- [ ] **Step 1: Add timer support to GameScene**

Add properties to `src/scenes/GameScene.ts` near the existing property declarations:

```typescript
  private timeLeft = 0;
  private timerEvent: Phaser.Time.TimerEvent | null = null;
```

In the `create()` method, replace the existing moves/timer initialization block (currently lines 47-50):

```typescript
    this.totalBubbles = this.grid.countBubbles();
    this.score = 0;
    this.gameOver = false;

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
```

Add the timer tick method to the class:

```typescript
  private onTimerTick(): void {
    if (this.gameOver) return;
    this.timeLeft--;
    this.events.emit('timer-update', this.timeLeft);
    if (this.timeLeft <= 0) {
      this.triggerLose('timeout');
    }
  }
```

- [ ] **Step 2: Update shutdown to clean up timer**

Modify the `shutdown()` method in GameScene:

```typescript
  shutdown(): void {
    if (this.timerEvent) {
      this.timerEvent.remove();
      this.timerEvent = null;
    }
    this.scene.stop('UIScene');
  }
```

- [ ] **Step 3: Update result overlay to use scene transitions**

Replace the `showResultOverlay()` method in GameScene:

```typescript
  private showResultOverlay(won: boolean, stars: number): void {
    const overlay = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x000000,
      0.75,
    );
    overlay.setDepth(10);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 80,
        won ? 'MISSION COMPLETE' : 'MISSION FAILED',
        {
          fontSize: '28px',
          color: won ? '#00e5ff' : '#ff4081',
          fontFamily: 'monospace',
          fontStyle: 'bold',
        },
      )
      .setOrigin(0.5)
      .setDepth(11);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, `SCORE: ${this.score}`, {
        fontSize: '20px',
        color: '#c0c8ff',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setDepth(11);

    if (won) {
      const starsText = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, starsText, {
          fontSize: '36px',
          color: '#ffd600',
        })
        .setOrigin(0.5)
        .setDepth(11);
    }

    // MAP button (always shown)
    const mapBtn = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 80, '[ MAP ]', {
        fontSize: '18px',
        color: '#c0c8ff',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setDepth(11)
      .setInteractive({ useHandCursor: true });

    mapBtn.on('pointerdown', () => {
      import('../utils/transition').then(({ fadeOutAndStart }) => {
        fadeOutAndStart(this, 'MapScene', {
          stopScenes: ['UIScene'],
        });
      });
    });

    // NEXT or RETRY button
    const hasNext = won && this.levelId < 10;
    const actionLabel = hasNext ? '[ NEXT MISSION ]' : '[ RETRY ]';
    const actionBtn = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 120, actionLabel, {
        fontSize: '18px',
        color: '#69f0ae',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setDepth(11)
      .setInteractive({ useHandCursor: true });

    actionBtn.on('pointerdown', () => {
      if (hasNext) {
        this.registry.set('currentLevel', this.levelId + 1);
      }
      import('../utils/transition').then(({ fadeOutAndStart }) => {
        fadeOutAndStart(this, 'GameScene', {
          stopScenes: ['UIScene'],
        });
      });
    });
  }
```

- [ ] **Step 4: Update advanceTurn to handle timer mode**

Replace the `advanceTurn()` method:

```typescript
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
      // Timer mode: only check win condition; timer loss handled by onTimerTick
      if (this.grid.isEmpty()) {
        this.triggerWin();
      }
    }
  }
```

- [ ] **Step 5: Emit initial timer event for timer levels**

In `create()`, after the timer initialization block, add:

```typescript
    this.scene.launch('UIScene');
    this.time.delayedCall(50, () => {
      if (this.levelData.type === 'timer') {
        this.events.emit('timer-update', this.timeLeft);
      } else {
        this.events.emit('moves-update', this.movesLeft);
      }
      this.events.emit('progress-update', this.grid.countBubbles(), this.totalBubbles);
    });
```

Remove the old delayedCall block (lines 77-80).

- [ ] **Step 6: Verify timer level works**

Run: `npm run dev`
Play through a level, verify:
- Win shows "MISSION COMPLETE" with stars, MAP button, NEXT button
- Lose shows "MISSION FAILED" with MAP button, RETRY button
- Clicking MAP fades to MapScene
- Clicking NEXT or RETRY fades to GameScene with correct level

- [ ] **Step 7: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: GameScene timer support and scene transition navigation"
```

---

## Task 7: Storage Helpers and Tests

**Files:**
- Modify: `src/utils/storage.ts` (already modified in Task 4)
- Create: `tests/utils/storage.test.ts`

- [ ] **Step 1: Write storage tests**

Create `tests/utils/storage.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSave,
  saveLevelResult,
  getLevelProgress,
  isLevelUnlocked,
} from '../../src/utils/storage';

beforeEach(() => {
  localStorage.clear();
});

describe('loadSave', () => {
  it('returns default when localStorage is empty', () => {
    const data = loadSave();
    expect(data.levels).toEqual({});
    expect(data.unlockedUpTo).toBe(1);
  });

  it('returns parsed data from localStorage', () => {
    localStorage.setItem(
      'bubble_spy_progress',
      JSON.stringify({ levels: { '1': { stars: 2, highScore: 1500 } }, unlockedUpTo: 2 }),
    );
    const data = loadSave();
    expect(data.levels['1']).toEqual({ stars: 2, highScore: 1500 });
    expect(data.unlockedUpTo).toBe(2);
  });

  it('returns default when localStorage has invalid JSON', () => {
    localStorage.setItem('bubble_spy_progress', 'not-json');
    const data = loadSave();
    expect(data.unlockedUpTo).toBe(1);
  });
});

describe('saveLevelResult', () => {
  it('saves first result for a level', () => {
    saveLevelResult(1, 2, 1500);
    const data = loadSave();
    expect(data.levels['1']).toEqual({ stars: 2, highScore: 1500 });
  });

  it('unlocks next level when earning at least 1 star', () => {
    saveLevelResult(1, 1, 800);
    expect(loadSave().unlockedUpTo).toBe(2);
  });

  it('does not unlock next level with 0 stars', () => {
    saveLevelResult(1, 0, 0);
    expect(loadSave().unlockedUpTo).toBe(1);
  });

  it('keeps best stars and high score', () => {
    saveLevelResult(1, 2, 1500);
    saveLevelResult(1, 1, 2000);
    const progress = loadSave().levels['1'];
    expect(progress.stars).toBe(2); // best kept
    expect(progress.highScore).toBe(2000); // best kept
  });
});

describe('getLevelProgress', () => {
  it('returns default for unseen level', () => {
    expect(getLevelProgress(5)).toEqual({ stars: 0, highScore: 0 });
  });

  it('returns saved progress', () => {
    saveLevelResult(2, 3, 5000);
    expect(getLevelProgress(2)).toEqual({ stars: 3, highScore: 5000 });
  });
});

describe('isLevelUnlocked', () => {
  it('returns true for level 1 by default', () => {
    expect(isLevelUnlocked(1)).toBe(true);
  });

  it('returns false for levels beyond unlockedUpTo', () => {
    expect(isLevelUnlocked(3)).toBe(false);
  });

  it('returns true after unlocking', () => {
    saveLevelResult(1, 1, 1000);
    expect(isLevelUnlocked(2)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: All 14 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/utils/storage.test.ts
git commit -m "test: add storage helper tests"
```

---

## Task 8: 7 New Level JSON Files

**Files:**
- Create: `src/data/levels/level-004.json`
- Create: `src/data/levels/level-005.json`
- Create: `src/data/levels/level-006.json`
- Create: `src/data/levels/level-007.json`
- Create: `src/data/levels/level-008.json`
- Create: `src/data/levels/level-009.json`
- Create: `src/data/levels/level-010.json`
- Create: `tests/data/levels.test.ts`

- [ ] **Step 1: Create level 4**

Create `src/data/levels/level-004.json`:

```json
{
  "id": 4,
  "name": "Deep Cover",
  "type": "moves",
  "moves": 25,
  "colors": ["RED", "BLUE", "GREEN", "YELLOW"],
  "grid": [
    ["RED", "GREEN", "BLUE", "YELLOW", "RED", "GREEN", "BLUE", "YELLOW"],
    ["GREEN", "BLUE", "YELLOW", "RED", "GREEN", "BLUE", "YELLOW"],
    ["BLUE", "YELLOW", "RED", "GREEN", "BLUE", "YELLOW", "RED", "GREEN"],
    ["YELLOW", "RED", "GREEN", "BLUE", "YELLOW", "RED", "GREEN"],
    ["RED", "GREEN", "BLUE", "YELLOW", "RED", "GREEN", "BLUE", "YELLOW"],
    ["GREEN", "BLUE", "YELLOW", "RED", "GREEN", "BLUE", "YELLOW"],
    ["BLUE", "YELLOW", "RED", "GREEN", "BLUE", "YELLOW", "RED", "GREEN"]
  ],
  "stars": [1200, 2800, 4500],
  "descentInterval": 0
}
```

- [ ] **Step 2: Create level 5**

Create `src/data/levels/level-005.json`:

```json
{
  "id": 5,
  "name": "Ghost Signal",
  "type": "moves",
  "moves": 20,
  "colors": ["RED", "BLUE", "GREEN", "YELLOW"],
  "grid": [
    ["YELLOW", "RED", "GREEN", "BLUE", "YELLOW", "RED", "GREEN", "BLUE"],
    ["RED", "GREEN", "BLUE", "YELLOW", "RED", "GREEN", "BLUE"],
    ["GREEN", "BLUE", "YELLOW", "RED", "GREEN", "BLUE", "YELLOW", "RED"],
    ["BLUE", "YELLOW", "RED", "GREEN", "BLUE", "YELLOW", "RED"],
    ["YELLOW", "RED", "GREEN", "BLUE", "YELLOW", "RED", "GREEN", "BLUE"],
    ["RED", "GREEN", "BLUE", "YELLOW", "RED", "GREEN", "BLUE"],
    ["GREEN", "BLUE", "YELLOW", "RED", "GREEN", "BLUE", "YELLOW", "RED"],
    ["BLUE", "YELLOW", "RED", "GREEN", "BLUE", "YELLOW", "RED"]
  ],
  "stars": [1400, 3200, 5200],
  "descentInterval": 0
}
```

- [ ] **Step 3: Create level 6**

Create `src/data/levels/level-006.json`:

```json
{
  "id": 6,
  "name": "Red Ledger",
  "type": "moves",
  "moves": 25,
  "colors": ["RED", "BLUE", "GREEN", "YELLOW", "PURPLE"],
  "grid": [
    ["PURPLE", "RED", "GREEN", "BLUE", "YELLOW", "PURPLE", "RED", "GREEN"],
    ["RED", "GREEN", "BLUE", "YELLOW", "PURPLE", "RED", "GREEN"],
    ["GREEN", "BLUE", "YELLOW", "PURPLE", "RED", "GREEN", "BLUE", "YELLOW"],
    ["BLUE", "YELLOW", "PURPLE", "RED", "GREEN", "BLUE", "YELLOW"],
    ["YELLOW", "PURPLE", "RED", "GREEN", "BLUE", "YELLOW", "PURPLE", "RED"],
    ["PURPLE", "RED", "GREEN", "BLUE", "YELLOW", "PURPLE", "RED"]
  ],
  "stars": [1500, 3500, 5800],
  "descentInterval": 0
}
```

- [ ] **Step 4: Create level 7 (timer-based)**

Create `src/data/levels/level-007.json`:

```json
{
  "id": 7,
  "name": "Nightfall",
  "type": "timer",
  "time": 60,
  "colors": ["RED", "BLUE", "GREEN", "YELLOW"],
  "grid": [
    ["RED", "BLUE", "GREEN", "YELLOW", "RED", "BLUE", "GREEN", "YELLOW"],
    ["BLUE", "GREEN", "YELLOW", "RED", "BLUE", "GREEN", "YELLOW"],
    ["GREEN", "YELLOW", "RED", "BLUE", "GREEN", "YELLOW", "RED", "BLUE"],
    ["YELLOW", "RED", "BLUE", "GREEN", "YELLOW", "RED", "BLUE"],
    ["RED", "BLUE", "GREEN", "YELLOW", "RED", "BLUE", "GREEN", "YELLOW"]
  ],
  "stars": [1000, 2500, 4000],
  "descentInterval": 0
}
```

- [ ] **Step 5: Create level 8**

Create `src/data/levels/level-008.json`:

```json
{
  "id": 8,
  "name": "Dead Drop",
  "type": "moves",
  "moves": 20,
  "colors": ["RED", "BLUE", "GREEN", "YELLOW", "PURPLE"],
  "grid": [
    ["YELLOW", "PURPLE", "RED", "GREEN", "BLUE", "YELLOW", "PURPLE", "RED"],
    ["PURPLE", "RED", "GREEN", "BLUE", "YELLOW", "PURPLE", "RED"],
    ["RED", "GREEN", "BLUE", "YELLOW", "PURPLE", "RED", "GREEN", "BLUE"],
    ["GREEN", "BLUE", "YELLOW", "PURPLE", "RED", "GREEN", "BLUE"],
    ["BLUE", "YELLOW", "PURPLE", "RED", "GREEN", "BLUE", "YELLOW", "PURPLE"],
    ["YELLOW", "PURPLE", "RED", "GREEN", "BLUE", "YELLOW", "PURPLE"],
    ["PURPLE", "RED", "GREEN", "BLUE", "YELLOW", "PURPLE", "RED", "GREEN"]
  ],
  "stars": [1800, 4000, 6500],
  "descentInterval": 0
}
```

- [ ] **Step 6: Create level 9**

Create `src/data/levels/level-009.json`:

```json
{
  "id": 9,
  "name": "Silent Protocol",
  "type": "moves",
  "moves": 18,
  "colors": ["RED", "BLUE", "GREEN", "YELLOW", "PURPLE"],
  "grid": [
    ["GREEN", "YELLOW", "PURPLE", "RED", "BLUE", "GREEN", "YELLOW", "PURPLE"],
    ["YELLOW", "PURPLE", "RED", "BLUE", "GREEN", "YELLOW", "PURPLE"],
    ["PURPLE", "RED", "BLUE", "GREEN", "YELLOW", "PURPLE", "RED", "BLUE"],
    ["RED", "BLUE", "GREEN", "YELLOW", "PURPLE", "RED", "BLUE"],
    ["BLUE", "GREEN", "YELLOW", "PURPLE", "RED", "BLUE", "GREEN", "YELLOW"],
    ["GREEN", "YELLOW", "PURPLE", "RED", "BLUE", "GREEN", "YELLOW"],
    ["YELLOW", "PURPLE", "RED", "BLUE", "GREEN", "YELLOW", "PURPLE", "RED"],
    ["PURPLE", "RED", "BLUE", "GREEN", "YELLOW", "PURPLE", "RED"]
  ],
  "stars": [2000, 4500, 7200],
  "descentInterval": 0
}
```

- [ ] **Step 7: Create level 10**

Create `src/data/levels/level-010.json`:

```json
{
  "id": 10,
  "name": "Final Extraction",
  "type": "moves",
  "moves": 15,
  "colors": ["RED", "BLUE", "GREEN", "YELLOW", "PURPLE", "CYAN"],
  "grid": [
    ["CYAN", "PURPLE", "RED", "GREEN", "BLUE", "YELLOW", "CYAN", "PURPLE"],
    ["PURPLE", "RED", "GREEN", "BLUE", "YELLOW", "CYAN", "PURPLE"],
    ["RED", "GREEN", "BLUE", "YELLOW", "CYAN", "PURPLE", "RED", "GREEN"],
    ["GREEN", "BLUE", "YELLOW", "CYAN", "PURPLE", "RED", "GREEN"],
    ["BLUE", "YELLOW", "CYAN", "PURPLE", "RED", "GREEN", "BLUE", "YELLOW"],
    ["YELLOW", "CYAN", "PURPLE", "RED", "GREEN", "BLUE", "YELLOW"],
    ["CYAN", "PURPLE", "RED", "GREEN", "BLUE", "YELLOW", "CYAN", "PURPLE"],
    ["PURPLE", "RED", "GREEN", "BLUE", "YELLOW", "CYAN", "PURPLE"]
  ],
  "stars": [2500, 5500, 9000],
  "descentInterval": 0
}
```

- [ ] **Step 8: Write level validation tests**

Create `tests/data/levels.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

const LEVEL_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe('Level data validation', () => {
  LEVEL_IDS.forEach((id) => {
    it(`level-${String(id).padStart(3, '0')} has valid structure`, async () => {
      const module = await import(`../../src/data/levels/level-${String(id).padStart(3, '0')}.json`);
      const level = module.default;

      expect(level.id).toBe(id);
      expect(typeof level.name).toBe('string');
      expect(level.name.length).toBeGreaterThan(0);
      expect(level.type).toMatch(/^(moves|timer)$/);
      expect(Array.isArray(level.colors)).toBe(true);
      expect(level.colors.length).toBeGreaterThanOrEqual(3);
      expect(Array.isArray(level.grid)).toBe(true);
      expect(level.grid.length).toBeGreaterThan(0);
      expect(Array.isArray(level.stars)).toBe(true);
      expect(level.stars).toHaveLength(3);
      expect(level.stars[0]).toBeLessThan(level.stars[1]);
      expect(level.stars[1]).toBeLessThan(level.stars[2]);

      if (level.type === 'moves') {
        expect(typeof level.moves).toBe('number');
        expect(level.moves).toBeGreaterThan(0);
      } else {
        expect(typeof level.time).toBe('number');
        expect(level.time).toBeGreaterThan(0);
      }
    });
  });
});
```

- [ ] **Step 9: Run tests**

Run: `npm test`
Expected: All storage tests (14) + all level validation tests (10) pass.

- [ ] **Step 10: Commit**

```bash
git add src/data/levels/level-00{4,5,6,7,8,9}.json src/data/levels/level-010.json tests/data/levels.test.ts
git commit -m "feat: add levels 4-10 with validation tests"
```

---

## Task 9: Final Integration Verification

**Files:**
- Modify: none (verification only)

- [ ] **Step 1: Full playthrough smoke test**

Run: `npm run dev`

Manually verify the complete flow:
1. BootScene loads with progress bar → auto transitions to MenuScene
2. MenuScene shows "BUBBLE SPY" title, floating bubbles, PLAY button
3. Click PLAY → fades to MapScene
4. MapScene shows 10 nodes in zig-zag, node 1 is current (magenta pulse), agent marker above it
5. Click node 1 → briefing overlay shows "Operation Neon", objective, START button
6. Click START → fades to GameScene
7. GameScene plays: HUD shows score, progress bar, moves counter
8. Win or lose the level → result overlay appears
9. Click MAP → fades back to MapScene
10. If won, node 1 shows cyan + stars, node 2 is now current (magenta)
11. Refresh browser → progress persists (stars and unlocked levels)

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: complete Phase 2 — Menu, Map, Progression, 10 levels"
```

---

## Self-Review

### 1. Spec Coverage

| Spec Requirement | Implementing Task |
|------------------|-------------------|
| MenuScene with animations | Task 3 |
| MapScene with node states, star display | Task 4 |
| LocalStorage persistence | Tasks 4, 7 (storage helpers + tests) |
| 10 levels with JSON configs | Task 8 |
| Level briefing overlay | Task 4 (showBriefing method) |
| Proper scene transitions (tweened) | Tasks 2, 4, 5, 6 |
| UIScene (Phase 1 gap) | Task 1 |
| Timer level support | Tasks 6, 8 (level-007) |

**Gaps:** None identified. All Phase 2 requirements are covered.

### 2. Placeholder Scan

No placeholders found. Every step contains complete code, exact file paths, exact commands, and expected outputs.

### 3. Type Consistency

- `LevelData` interface already supports `type: 'moves' | 'timer'` and optional `moves`/`time` — consistent with GameScene usage in Task 6.
- `getLevelProgress` and `isLevelUnlocked` return types match usage in MapScene.
- `fadeOutAndStart` signature accepts `stopScenes` array — used consistently in MapScene and GameScene.
- Event names (`score-update`, `moves-update`, `timer-update`, `progress-update`, `game-over`) are consistent between GameScene and UIScene.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-09-bubble-spy-phase-2.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints for review.

**Which approach?**

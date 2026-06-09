# Bubble Spy — Design Spec

**Date:** 2026-06-09
**Platform:** Web browser (HTML5)
**Engine:** Phaser 3
**Theme:** Spy / covert ops — dark backgrounds, neon bubbles, tactical mission map

---

## Overview

A production-grade bubble shooter game with spy aesthetic. Player fires colored bubbles from a shooter at the bottom, matching 3+ same-color bubbles to pop them. Progression flows through a tactical mission map with numbered levels. Built in phased delivery.

---

## Scenes

### BootScene
Preloads all assets (spritesheets, audio, JSON level data). Shows minimal loading bar. Transitions to MenuScene on complete.

### MenuScene
- Dark starfield background with parallax layers
- "BUBBLE SPY" title with neon cyan glow (`text-shadow` via Phaser Text + glow FX)
- Animated agent silhouette (spritesheet idle loop)
- Floating neon bubbles drifting in background (Phaser particles or tweened sprites)
- PLAY button → transition to MapScene (slide/fade tween)
- SETTINGS icon (bottom-left), MISSIONS/LEADERBOARD icon (bottom-right)

### MapScene
- Dark tactical map background (illustrated or generated grid)
- Level nodes: numbered circles connected by dashed lines
- Node states: completed (cyan, shows star rating), current (magenta pulse), locked (grey)
- Stars (0–3) displayed under each completed node
- Tap/click node → show mission briefing overlay (level name, objective, best score) → START button
- Back button → MenuScene
- Player agent marker sits on current level node

### GameScene
Core gameplay. Runs simultaneously with UIScene (parallel Phaser scene).

### UIScene (overlay, runs parallel to GameScene)
- Score counter (top-left, increments with tween on pop)
- Progress bar (top-center, fills as bubbles cleared)
- Star thresholds shown on progress bar (at 33%, 66%, 100%)
- Moves counter or timer depending on level type (top-right)
- Pause button

---

## Core Game Logic

### Grid

- Hexagonal offset grid: even rows start at x=0, odd rows offset by half bubble width
- Grid dimensions: configurable per level (default 8 columns × 10 rows visible)
- Each cell stores: `{ color: BubbleColor | null, gameObject: Phaser.GameObjects.Image | null }`
- `BubbleColor` enum: RED, BLUE, GREEN, YELLOW, PURPLE, CYAN (6 colors max per level, subset configurable)
- Grid anchored to top of play area, descends on turn interval (configurable per level)

### Shooter

- Mounted at bottom-center of GameScene
- Mouse position (desktop) or touch position (mobile) drives aim angle
- Min angle: 10° from horizontal (prevent straight-left/right shots)
- Trajectory preview: dotted line following reflection physics off left/right walls (max 3 bounces shown)
- Bubble queue: `current` (shown in shooter) and `next` (shown in preview slot beside shooter)
- Fire on click/tap: launches current bubble as physics body, queues next
- Cooldown: 300ms between shots (prevents spam)

### Collision & Snap

- Bubble travels as `Phaser.Physics.Arcade` body at fixed speed (800px/s)
- Wall bounce: reverse vx on left/right wall contact
- Ceiling collision OR grid bubble collision → snap to nearest empty hex cell
- Snap uses grid coordinate conversion: pixel position → nearest `(row, col)`
- After snap: run match detection

### Match Detection

1. BFS flood-fill from snapped cell: collect all connected same-color cells
2. If count ≥ 3: pop all matched cells
3. After pop: run orphan detection
4. Orphan detection: BFS from top row — any cell not reachable from ceiling is orphaned
5. Orphaned bubbles: animate arc fall off screen (Phaser tween: y += 400, alpha → 0)
6. Score: 100 per bubble popped directly, 50 per orphan dropped

### Win / Lose Conditions

- **Win:** All bubbles cleared from grid
- **Lose (moves-based):** Bubble count reaches 0 with bubbles remaining
- **Lose (time-based):** Timer reaches 0
- **Lose (overflow):** Grid descends past the danger line

### Level Data Format

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
    ...
  ],
  "stars": [1000, 2500, 4000],
  "descentInterval": 0
}
```

`grid` is an array of rows (top to bottom). Odd-index rows have one fewer column (hex offset). `null` = empty cell.

---

## Effects System

### Bubble Pop Particles
- On match pop: emit 12–16 particles per bubble in that bubble's color
- Particle: small circle sprite, velocity outward radial, scale 1→0, alpha 1→0 over 400ms
- Implemented via `Phaser.GameObjects.Particles.ParticleEmitter`

### Screen Shake
- Triggered on every successful pop
- Intensity: `0.005 * matchCount` (scales with combo size)
- Duration: 150ms
- Implemented via `this.cameras.main.shake(150, intensity)`

### Score Float Text
- On pop: spawn text at pop location showing `+NNN`
- Tween: y -= 60, alpha 1→0 over 600ms, then destroy

### Orphan Fall
- Tween: y += 500, alpha 1→0, rotation += random, duration 500ms
- Stagger delay per orphan: `index * 40ms`

### Bubble Shoot Animation
- Scale pulse on fire: 1.0 → 1.15 → 1.0 over 100ms (shooter gadget recoil)

### Level Transition
- Win: bubbles implode to center (scale → 0), then scene slides out
- Lose: scene fades to red tint then fades to result screen

---

## Progression & Persistence

### LocalStorage Schema

```json
{
  "levels": {
    "1": { "stars": 3, "highScore": 4200 },
    "2": { "stars": 2, "highScore": 2800 }
  },
  "unlockedUpTo": 3
}
```

- Level `N+1` unlocks when level `N` earns ≥ 1 star
- Stars never decrease (best result kept)

### Star Scoring
- Each level defines 3 score thresholds in its JSON
- Score at win/lose time determines 0–3 stars

---

## Visual Design

### Color Palette
| Role | Hex |
|------|-----|
| Background deep | `#050510` |
| Background mid | `#0a1428` |
| Neon cyan (primary) | `#00e5ff` |
| Neon magenta | `#ff4081` |
| Neon purple | `#7c4dff` |
| Neon green | `#69f0ae` |
| Text primary | `#c0c8ff` |
| Text muted | `#8892b0` |

### Bubble Colors (in-game)
| Name | Base | Glow |
|------|------|------|
| RED | `#ff6b6b` | `#ff4081` |
| BLUE | `#7986ff` | `#7c4dff` |
| CYAN | `#4dd0e1` | `#00e5ff` |
| GREEN | `#a5d6a7` | `#69f0ae` |
| YELLOW | `#fff176` | `#ffd600` |
| PURPLE | `#ce93d8` | `#aa00ff` |

Each bubble sprite: radial gradient base + highlight spot (top-left) + glow ring. Rendered as canvas texture at boot.

### Typography
- Title: bold, wide letter-spacing, neon glow via Phaser FX
- HUD: monospace, small, cyan
- Map labels: small caps, muted

---

## Phase Breakdown

### Phase 1 — Core Gameplay Loop
- Phaser project scaffold (Vite + Phaser 3)
- BootScene (asset preload)
- GameScene: hex grid render, shooter, trajectory line, collision/snap, match detection, orphan detection
- UIScene: score, progress bar, moves counter
- Effects: particles, screen shake, score float text
- 3 hardcoded levels (JSON files)
- Win/lose screens (simple overlays)

### Phase 2 — Menu + Map + Progression
- MenuScene with animations
- MapScene with node states, star display
- LocalStorage persistence
- 10 levels with JSON configs
- Level briefing overlay
- Proper scene transitions (tweened)

### Phase 3 — Polish
- Particle system tuning
- Sound effects (Phaser Web Audio)
- Background music loop
- Bubble idle animation (gentle pulse)
- Map scene parallax / ambient animations
- Mobile touch support tuning

### Phase 4 — Special Bubbles & Power-ups
- Stone bubble (requires 2 hits)
- Bomb bubble (pops 2-ring radius)
- Wildcard bubble (matches any color)
- Power-up: aim assist (extended trajectory)
- Power-up: color bomb (clear all of one color)
- Per-level special bubble configs in JSON

---

## Tech Stack

| Concern | Choice |
|---------|--------|
| Game engine | Phaser 3 (latest) |
| Build tool | Vite |
| Language | TypeScript |
| Assets | Procedural canvas textures (no external sprites in Phase 1) |
| Persistence | localStorage |
| Audio | Phaser Web Audio Manager |
| Target browsers | Chrome, Firefox, Safari (desktop + mobile) |

---

## File Structure (Phase 1)

```
bubble-shooter/
├── src/
│   ├── main.ts              # Phaser game config, mount
│   ├── scenes/
│   │   ├── BootScene.ts
│   │   ├── MenuScene.ts
│   │   ├── MapScene.ts
│   │   ├── GameScene.ts
│   │   └── UIScene.ts
│   ├── game/
│   │   ├── Grid.ts          # Grid state + match/orphan logic
│   │   ├── Shooter.ts       # Aim, queue, fire
│   │   ├── Bubble.ts        # BubbleColor enum, sprite factory
│   │   ├── Trajectory.ts    # Trajectory preview line
│   │   └── Effects.ts       # Particles, shake, float text
│   ├── data/
│   │   └── levels/
│   │       ├── level-001.json
│   │       ├── level-002.json
│   │       └── level-003.json
│   └── utils/
│       ├── hexUtils.ts      # Grid ↔ pixel coordinate math
│       └── storage.ts       # LocalStorage read/write
├── public/
├── index.html
├── vite.config.ts
└── tsconfig.json
```

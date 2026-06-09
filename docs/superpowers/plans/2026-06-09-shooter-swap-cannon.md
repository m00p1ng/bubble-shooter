# Shooter Swap and Cannon Wrapper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the next bubble clickable for unlimited pre-shot swaps and frame the active bubble in a neon energy-cradle cannon.

**Architecture:** Keep queue mutation and pointer handling inside `Shooter`, which already owns the active/next state and sprites. Generate the energy cradle once in `BootScene` as a procedural texture, expose its key from `Bubble.ts`, and render it behind the active bubble without changing `GameScene`.

**Tech Stack:** TypeScript, Phaser 3, Vitest, Vite

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/game/Bubble.ts` | Export the energy-cradle texture key |
| `src/game/Shooter.ts` | Own clickable NEXT behavior, queue swap, texture refresh, and cradle sprite |
| `src/scenes/BootScene.ts` | Generate the neon energy-cradle canvas texture |
| `tests/game/Shooter.test.ts` | Verify click swaps, repeated swaps, texture refresh, and cooldown blocking |

### Task 1: Add Click-to-Swap Shooter Behavior

**Files:**
- Create: `tests/game/Shooter.test.ts`
- Modify: `src/game/Shooter.ts`

- [ ] **Step 1: Write the failing Shooter tests**

Create `tests/game/Shooter.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

type PointerHandler = () => void;

const images: Array<{
  x: number;
  y: number;
  texture: string;
  setScale: ReturnType<typeof vi.fn>;
  setTexture: ReturnType<typeof vi.fn>;
  setInteractive: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  pointerDown?: PointerHandler;
}> = [];

class MockEventEmitter {
  private listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  on(event: string, callback: (...args: unknown[]) => void): this {
    const callbacks = this.listeners.get(event) ?? [];
    callbacks.push(callback);
    this.listeners.set(event, callbacks);
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    for (const callback of this.listeners.get(event) ?? []) callback(...args);
    return true;
  }

  removeAllListeners(): this {
    this.listeners.clear();
    return this;
  }
}

vi.mock('phaser', () => ({
  default: {
    Events: { EventEmitter: MockEventEmitter },
    Math: {
      Clamp: (value: number, min: number, max: number) =>
        Math.min(max, Math.max(min, value)),
    },
  },
}));

import { Shooter } from '../../src/game/Shooter';

function createImage(x: number, y: number, texture: string) {
  const image = {
    x,
    y,
    texture,
    setScale: vi.fn(),
    setTexture: vi.fn(),
    setInteractive: vi.fn(),
    on: vi.fn(),
    destroy: vi.fn(),
    pointerDown: undefined as PointerHandler | undefined,
  };
  image.setScale.mockReturnValue(image);
  image.setTexture.mockReturnValue(image);
  image.setInteractive.mockReturnValue(image);
  image.on.mockImplementation((event: string, callback: PointerHandler) => {
    if (event === 'pointerdown') image.pointerDown = callback;
    return image;
  });
  images.push(image);
  return image;
}

function createScene() {
  return {
    add: {
      image: vi.fn((x: number, y: number, texture: string) =>
        createImage(x, y, texture),
      ),
      text: vi.fn(() => ({ setOrigin: vi.fn() })),
    },
    tweens: { add: vi.fn() },
    time: { delayedCall: vi.fn() },
  };
}

describe('Shooter bubble swapping', () => {
  beforeEach(() => {
    images.length = 0;
    vi.restoreAllMocks();
  });

  it('clicking NEXT swaps complete queued bubbles and refreshes textures', () => {
    const shooter = new Shooter(createScene() as never, ['RED', 'BLUE']);
    shooter.current = { color: 'RED', type: 'STONE' };
    shooter.next = { color: 'BLUE', type: 'BOMB' };
    const activeSprite = images.find((image) => image.x === 240)!;
    const nextSprite = images.find((image) => image.x === 292)!;

    nextSprite.pointerDown?.();

    expect(shooter.current).toEqual({ color: 'BLUE', type: 'BOMB' });
    expect(shooter.next).toEqual({ color: 'RED', type: 'STONE' });
    expect(activeSprite.setTexture).toHaveBeenLastCalledWith('bubble_BOMB_BLUE');
    expect(nextSprite.setTexture).toHaveBeenLastCalledWith('bubble_STONE_RED');
  });

  it('allows unlimited swaps before firing', () => {
    const shooter = new Shooter(createScene() as never, ['RED', 'BLUE']);
    shooter.current = { color: 'RED', type: 'NORMAL' };
    shooter.next = { color: 'BLUE', type: 'WILDCARD' };
    const nextSprite = images.find((image) => image.x === 292)!;

    nextSprite.pointerDown?.();
    nextSprite.pointerDown?.();

    expect(shooter.current).toEqual({ color: 'RED', type: 'NORMAL' });
    expect(shooter.next).toEqual({ color: 'BLUE', type: 'WILDCARD' });
  });

  it('ignores swaps during post-fire cooldown', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const shooter = new Shooter(createScene() as never, ['RED', 'BLUE']);
    shooter.current = { color: 'RED', type: 'NORMAL' };
    shooter.next = { color: 'BLUE', type: 'BOMB' };

    shooter.fire();
    const currentAfterFire = shooter.current;
    const nextAfterFire = shooter.next;
    images.find((image) => image.x === 292)!.pointerDown?.();

    expect(shooter.current).toEqual(currentAfterFire);
    expect(shooter.next).toEqual(nextAfterFire);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- tests/game/Shooter.test.ts
```

Expected: FAIL because the next sprite has no pointer handler and the queue does not swap.

- [ ] **Step 3: Implement queue swapping and NEXT interaction**

In `src/game/Shooter.ts`, add this method:

```typescript
  swapBubbles(): void {
    if (this.cooldown) return;

    [this.current, this.next] = [this.next, this.current];
    this.refreshBubbleTextures();
  }

  private refreshBubbleTextures(): void {
    this.currentSprite.setTexture(
      getBubbleTextureKey(this.current.color, this.current.type),
    );
    this.nextSprite.setTexture(
      getBubbleTextureKey(this.next.color, this.next.type),
    );
  }
```

In `createSprites()`, make the next sprite interactive and register the swap:

```typescript
    this.nextSprite = this.scene.add.image(
      SHOOTER_X + 52,
      SHOOTER_Y + 10,
      getBubbleTextureKey(this.next.color, this.next.type),
    ).setScale(0.75).setInteractive({ useHandCursor: true });
    this.nextSprite.on('pointerdown', () => this.swapBubbles());
```

In `fire()`, replace the two direct `setTexture` calls with:

```typescript
    this.refreshBubbleTextures();
```

- [ ] **Step 4: Run the focused test**

Run:

```bash
npm test -- tests/game/Shooter.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit the swap behavior**

```bash
git add src/game/Shooter.ts tests/game/Shooter.test.ts
git commit -m "feat: swap current and next shooter bubbles"
```

### Task 2: Generate and Render the Energy Cradle

**Files:**
- Modify: `src/game/Bubble.ts`
- Modify: `src/scenes/BootScene.ts`
- Modify: `src/game/Shooter.ts`
- Test: `tests/game/Shooter.test.ts`

- [ ] **Step 1: Write the failing cradle lifecycle test**

Add to `tests/game/Shooter.test.ts`:

```typescript
  it('creates and destroys the energy cradle with the shooter', () => {
    const shooter = new Shooter(createScene() as never, ['RED']);
    const cradle = images.find((image) => image.texture === 'shooter_cradle');

    expect(cradle).toBeDefined();

    shooter.destroy();

    expect(cradle?.destroy).toHaveBeenCalledOnce();
  });
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- tests/game/Shooter.test.ts
```

Expected: FAIL because no image uses the `shooter_cradle` texture.

- [ ] **Step 3: Add the cradle texture key**

In `src/game/Bubble.ts`, add after `getShooterTextureKey()`:

```typescript
export function getShooterCradleTextureKey(): string {
  return 'shooter_cradle';
}
```

- [ ] **Step 4: Generate the selected Energy Cradle texture**

Update the Bubble import in `src/scenes/BootScene.ts`:

```typescript
import {
  ALL_COLORS,
  COLOR_CONFIG,
  getBubbleTextureKey,
  getShooterCradleTextureKey,
  getShooterTextureKey,
} from '../game/Bubble';
```

In `create()`, call the generator after `generateShooterTexture()`:

```typescript
    this.generateShooterCradleTexture();
```

Add this method after `generateShooterTexture()`:

```typescript
  private generateShooterCradleTexture(): void {
    const key = getShooterCradleTextureKey();
    if (this.textures.exists(key)) return;

    const size = 92;
    const center = size / 2;
    const texture = this.textures.createCanvas(key, size, size)!;
    const ctx = texture.context;

    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(center, center, 38, Math.PI * 0.12, Math.PI * 0.88, true);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#7c4dff';
    ctx.beginPath();
    ctx.moveTo(center - 28, size - 16);
    ctx.lineTo(center + 28, size - 16);
    ctx.lineTo(center + 36, size - 2);
    ctx.lineTo(center - 36, size - 2);
    ctx.closePath();
    ctx.fill();

    texture.refresh();
  }
```

- [ ] **Step 5: Render and own the cradle in Shooter**

Update the Bubble import in `src/game/Shooter.ts`:

```typescript
import {
  getBubbleTextureKey,
  getShooterCradleTextureKey,
} from './Bubble';
```

Add the field:

```typescript
  private cradleSprite!: Phaser.GameObjects.Image;
```

At the start of `createSprites()`, before creating `currentSprite`, add:

```typescript
    this.cradleSprite = this.scene.add.image(
      SHOOTER_X,
      SHOOTER_Y - BUBBLE_RADIUS * 1.5,
      getShooterCradleTextureKey(),
    );
```

In `destroy()`, destroy the cradle first:

```typescript
    this.cradleSprite.destroy();
```

- [ ] **Step 6: Run the focused test and verify GREEN**

Run:

```bash
npm test -- tests/game/Shooter.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 7: Run all tests and build**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass and the TypeScript/Vite build succeeds.

- [ ] **Step 8: Commit the completed cradle**

```bash
git add src/game/Bubble.ts src/game/Shooter.ts src/scenes/BootScene.ts tests/game/Shooter.test.ts
git commit -m "feat: add shooter energy cradle"
```

### Task 3: Visual and Regression Verification

**Files:**
- No production file changes expected

- [ ] **Step 1: Start the local app**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: Vite prints a local URL without startup errors.

- [ ] **Step 2: Verify the shooter visually**

Open a level and confirm:

- The active bubble is centered inside the cyan energy cradle.
- The cradle is behind the bubble and does not obscure its color or special type.
- The open top visually preserves the firing direction.
- The purple base anchors the cannon without overlapping the NEXT bubble.

- [ ] **Step 3: Verify swap interaction**

Confirm:

- Clicking NEXT swaps active and next colors/types.
- Repeated clicks alternate the two bubbles without limit.
- Clicking NEXT immediately after firing does not alter the queue during cooldown.
- Firing after a swap launches the bubble currently displayed in the cradle.

- [ ] **Step 4: Run final automated verification**

Run:

```bash
npm test
npm run build
git diff --check HEAD^
git status --short
```

Expected: all tests pass, build succeeds, no whitespace errors, and the worktree is clean.

## Self-Review

### Spec Coverage

| Requirement | Plan Task |
|-------------|-----------|
| Click NEXT to swap full color/type values | Task 1 |
| Unlimited swaps before firing | Task 1 |
| Block swaps during cooldown | Task 1 |
| Refresh both textures | Task 1 |
| Energy cradle around active bubble | Task 2 |
| Procedural texture generated in BootScene | Task 2 |
| Cradle lifecycle owned by Shooter | Task 2 |
| Focused tests, full suite, build, visual check | Tasks 1-3 |

### Consistency Notes

- `Shooter` remains the only owner of queue state.
- Shooter tests identify active and next sprites by their established positions, so adding the cradle does not make the swap tests order-dependent.
- No `GameScene` change or new event is introduced.
- Every task has its own red-green cycle and ends with passing focused tests.

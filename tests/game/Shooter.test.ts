import { beforeEach, describe, expect, it, vi } from 'vitest';

type PointerHandler = (
  pointer?: unknown,
  localX?: number,
  localY?: number,
  event?: { stopPropagation: () => void },
) => void;

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

vi.mock('phaser', () => ({
  default: (() => {
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

    return {
      Events: { EventEmitter: MockEventEmitter },
      Math: {
        Clamp: (value: number, min: number, max: number) =>
          Math.min(max, Math.max(min, value)),
      },
    };
  })(),
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
    const shooter = new Shooter(createScene() as never, () => ['RED', 'BLUE']);
    shooter.current = { color: 'RED', type: 'STONE' };
    shooter.next = { color: 'BLUE', type: 'BOMB' };
    const activeSprite = images.find(
      (image) => image.x === 240 && image.texture !== 'shooter_cradle',
    )!;
    const nextSprite = images.find((image) => image.x === 292)!;

    expect(nextSprite.pointerDown).toBeTypeOf('function');
    nextSprite.pointerDown?.(undefined, 0, 0, { stopPropagation: vi.fn() });

    expect(shooter.current).toEqual({ color: 'BLUE', type: 'BOMB' });
    expect(shooter.next).toEqual({ color: 'RED', type: 'STONE' });
    expect(activeSprite.setTexture).toHaveBeenLastCalledWith('bubble_BOMB_BLUE');
    expect(nextSprite.setTexture).toHaveBeenLastCalledWith('bubble_STONE_RED');
  });

  it('stops the NEXT click from reaching the scene fire handler', () => {
    const shooter = new Shooter(createScene() as never, () => ['RED', 'BLUE']);
    shooter.current = { color: 'RED', type: 'NORMAL' };
    shooter.next = { color: 'BLUE', type: 'NORMAL' };
    const nextSprite = images.find((image) => image.x === 292)!;
    const event = { stopPropagation: vi.fn() };

    nextSprite.pointerDown?.(undefined, 0, 0, event);

    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(shooter.current.color).toBe('BLUE');
  });

  it('allows unlimited swaps before firing', () => {
    const shooter = new Shooter(createScene() as never, () => ['RED', 'BLUE']);
    shooter.current = { color: 'RED', type: 'NORMAL' };
    shooter.next = { color: 'BLUE', type: 'WILDCARD' };
    const nextSprite = images.find((image) => image.x === 292)!;

    expect(nextSprite.pointerDown).toBeTypeOf('function');
    nextSprite.pointerDown?.(undefined, 0, 0, { stopPropagation: vi.fn() });
    expect(shooter.current).toEqual({ color: 'BLUE', type: 'WILDCARD' });
    expect(shooter.next).toEqual({ color: 'RED', type: 'NORMAL' });

    nextSprite.pointerDown?.(undefined, 0, 0, { stopPropagation: vi.fn() });

    expect(shooter.current).toEqual({ color: 'RED', type: 'NORMAL' });
    expect(shooter.next).toEqual({ color: 'BLUE', type: 'WILDCARD' });
  });

  it('ignores swaps during post-fire cooldown', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const shooter = new Shooter(createScene() as never, () => ['RED', 'BLUE']);
    shooter.current = { color: 'RED', type: 'NORMAL' };
    shooter.next = { color: 'BLUE', type: 'BOMB' };

    shooter.fire();
    const currentAfterFire = shooter.current;
    const nextAfterFire = shooter.next;
    const nextSprite = images.find((image) => image.x === 292)!;
    expect(nextSprite.pointerDown).toBeTypeOf('function');
    nextSprite.pointerDown?.(undefined, 0, 0, { stopPropagation: vi.fn() });

    expect(shooter.current).toEqual(currentAfterFire);
    expect(shooter.next).toEqual(nextAfterFire);
  });

  it('creates and destroys the energy cradle with the shooter', () => {
    const shooter = new Shooter(createScene() as never, () => ['RED']);
    const cradle = images.find((image) => image.texture === 'shooter_cradle');

    expect(cradle).toBeDefined();

    shooter.destroy();

    expect(cradle?.destroy).toHaveBeenCalledOnce();
  });
});

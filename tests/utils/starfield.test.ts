import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Math: {
      Between: vi.fn((min: number) => min),
      FloatBetween: vi.fn((min: number) => min),
    },
  },
}));

import { createStarfield } from '../../src/utils/starfield';

describe('createStarfield', () => {
  it('moves star layers at different speeds for visible parallax', () => {
    const stars: unknown[] = [];
    const containers: Array<{
      x: number;
      y: number;
      add: ReturnType<typeof vi.fn>;
      setDepth: ReturnType<typeof vi.fn>;
    }> = [];
    let onPointerMove: ((pointer: { x: number; y: number }) => void) | undefined;
    const scene = {
      scale: { width: 480, height: 720 },
      add: {
        container: vi.fn(() => {
          const container = {
            x: 0,
            y: 0,
            add: vi.fn((item: unknown) => stars.push(item)),
            setDepth: vi.fn(),
          };
          containers.push(container);
          return container;
        }),
        circle: vi.fn(() => ({})),
      },
      input: {
        on: vi.fn((event: string, callback: typeof onPointerMove) => {
          if (event === 'pointermove') onPointerMove = callback;
        }),
      },
    };

    createStarfield(scene as any);

    expect(stars).toHaveLength(80);
    expect(containers).toHaveLength(3);

    onPointerMove?.({ x: 480, y: 720 });
    expect(containers[0].x).toBeLessThan(containers[1].x);
    expect(containers[1].x).toBeLessThan(containers[2].x);
    expect(containers[2].x).toBe(14);
  });
});

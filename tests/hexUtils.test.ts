import { describe, it, expect } from 'vitest';
import {
  gridToPixel,
  pixelToNearestGrid,
  getNeighbors,
  isGridCellPastDangerLine,
} from '../src/utils/hexUtils';
import {
  GRID_ORIGIN_X,
  GRID_ORIGIN_Y,
  COL_WIDTH,
  ROW_HEIGHT,
  GRID_COLS,
  BUBBLE_RADIUS,
  HUD_HEIGHT,
} from '../src/config';

describe('gridToPixel', () => {
  it('returns origin for cell (0, 0)', () => {
    const { x, y } = gridToPixel(0, 0);
    expect(x).toBe(GRID_ORIGIN_X);
    expect(y).toBe(GRID_ORIGIN_Y);
  });

  it('keeps the top bubble below the HUD', () => {
    const { y } = gridToPixel(0, 0);
    expect(y - BUBBLE_RADIUS).toBeGreaterThanOrEqual(HUD_HEIGHT);
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

describe('isGridCellPastDangerLine', () => {
  it('does not reject the lowest legal grid row', () => {
    expect(isGridCellPastDangerLine(9, 0)).toBe(false);
  });
});

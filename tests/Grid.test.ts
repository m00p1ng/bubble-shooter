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
    const g = new Grid(4, 5);
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

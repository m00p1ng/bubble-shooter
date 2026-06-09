import { describe, expect, it } from 'vitest';
import { Grid } from '../src/game/Grid';

describe('Grid with special bubbles', () => {
  it('findMatch excludes STONE bubbles', () => {
    const grid = new Grid(3, 4);
    grid.loadFromData([
      ['RED', 'RED', { type: 'STONE', color: 'RED' }, null],
      ['RED', null, null],
      [null, null, null, null],
    ]);

    expect(grid.findMatch(0, 0)).toEqual(
      expect.arrayContaining([
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 0 },
      ]),
    );
    expect(grid.findMatch(0, 0)).toHaveLength(3);
  });

  it('getCellsInRadius returns correct ring-2 hex cells', () => {
    const grid = new Grid(5, 6);
    grid.loadFromData([
      ['RED', 'RED', 'RED', 'RED', 'RED', 'RED'],
      ['RED', 'RED', 'RED', 'RED', 'RED'],
      ['RED', 'RED', 'RED', 'RED', 'RED', 'RED'],
      ['RED', 'RED', 'RED', 'RED', 'RED'],
      ['RED', 'RED', 'RED', 'RED', 'RED', 'RED'],
    ]);

    const cells = grid.getCellsInRadius(2, 2, 2);
    expect(cells).toHaveLength(19);
    expect(cells).toContainEqual({ row: 2, col: 2 });
    expect(cells).toContainEqual({ row: 0, col: 2 });
    expect(cells).toContainEqual({ row: 4, col: 2 });
  });

  it('damageCell reduces STONE hitPoints', () => {
    const grid = new Grid(2, 4);
    grid.loadFromData([[{ type: 'STONE', color: 'RED' }, null, null, null]]);

    grid.damageCell(0, 0);

    expect(grid.getCell(0, 0)?.hitPoints).toBe(1);
  });

  it('damageCell destroys STONE at 1 HP', () => {
    const grid = new Grid(2, 4);
    grid.loadFromData([[{ type: 'STONE', color: 'RED' }, null, null, null]]);

    grid.damageCell(0, 0);
    grid.damageCell(0, 0);

    expect(grid.getCell(0, 0)?.color).toBeNull();
  });

  it('wildcard matches any color when effective color is provided', () => {
    const grid = new Grid(3, 4);
    grid.loadFromData([
      ['RED', { type: 'WILDCARD' }, 'RED', null],
      [null, null, null],
      [null, null, null, null],
    ]);

    expect(grid.findMatch(0, 1, 'RED')).toHaveLength(3);
  });
});

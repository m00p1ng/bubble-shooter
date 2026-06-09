import { describe, expect, it } from 'vitest';
import { parseGridCellData } from '../src/game/Bubble';

describe('parseGridCellData', () => {
  it('parses null as null', () => {
    expect(parseGridCellData(null)).toBeNull();
  });

  it('parses string color as NORMAL type', () => {
    expect(parseGridCellData('RED')).toEqual({
      color: 'RED',
      type: 'NORMAL',
      hitPoints: 1,
    });
  });

  it('parses STONE object', () => {
    expect(parseGridCellData({ type: 'STONE', color: 'BLUE' })).toEqual({
      color: 'BLUE',
      type: 'STONE',
      hitPoints: 2,
    });
  });

  it('parses BOMB object with default color RED', () => {
    expect(parseGridCellData({ type: 'BOMB' })).toEqual({
      color: 'RED',
      type: 'BOMB',
      hitPoints: 1,
    });
  });

  it('parses WILDCARD object', () => {
    expect(parseGridCellData({ type: 'WILDCARD' })).toEqual({
      color: 'RED',
      type: 'WILDCARD',
      hitPoints: 1,
    });
  });

  it('throws on unknown string', () => {
    expect(() => parseGridCellData('PINK')).toThrow('Unknown bubble color');
  });
});

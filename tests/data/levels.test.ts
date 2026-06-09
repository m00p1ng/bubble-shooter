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

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadSave,
  saveLevelResult,
  getLevelProgress,
  isLevelUnlocked,
} from '../../src/utils/storage';

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  removeItem: (key: string) => { delete store[key]; },
};
vi.stubGlobal('localStorage', localStorageMock);

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
    expect(progress.stars).toBe(2);
    expect(progress.highScore).toBe(2000);
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

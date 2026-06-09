const STORAGE_KEY = 'bubble_spy_progress';

export interface LevelProgress {
  stars: number;
  highScore: number;
}

export interface SaveData {
  levels: Record<string, LevelProgress>;
  unlockedUpTo: number;
}

const DEFAULT: SaveData = { levels: {}, unlockedUpTo: 1 };

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SaveData) : { ...DEFAULT };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveLevelResult(levelId: number, stars: number, score: number): void {
  const data = loadSave();
  const prev = data.levels[levelId] ?? { stars: 0, highScore: 0 };
  data.levels[levelId] = {
    stars: Math.max(prev.stars, stars),
    highScore: Math.max(prev.highScore, score),
  };
  if (stars >= 1) data.unlockedUpTo = Math.max(data.unlockedUpTo, levelId + 1);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

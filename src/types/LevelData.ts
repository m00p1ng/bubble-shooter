import type { BubbleColor } from '../game/Bubble';

export interface LevelData {
  id: number;
  name: string;
  type: 'moves' | 'timer';
  moves?: number;
  time?: number;
  colors: BubbleColor[];
  grid: (BubbleColor | null)[][];
  stars: [number, number, number];
  descentInterval: number;
}

import type { BubbleColor, GridCellData } from '../game/Bubble';

export interface LevelData {
  id: number;
  name: string;
  type: 'moves' | 'timer';
  moves?: number;
  time?: number;
  colors: BubbleColor[];
  grid: GridCellData[][];
  stars: [number, number, number];
  descentInterval: number;
  specialBubbles?: {
    stone?: boolean;
    bomb?: boolean;
    wildcard?: boolean;
  };
  shooterSpecialChance?: number;
}

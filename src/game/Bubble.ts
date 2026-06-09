export type BubbleColor = 'RED' | 'BLUE' | 'GREEN' | 'YELLOW' | 'PURPLE' | 'CYAN';

export const ALL_COLORS: BubbleColor[] = ['RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE', 'CYAN'];

export interface BubbleColorConfig {
  base: string;
  glow: string;
}

export const COLOR_CONFIG: Record<BubbleColor, BubbleColorConfig> = {
  RED:    { base: '#ff6b6b', glow: '#ff4081' },
  BLUE:   { base: '#7986ff', glow: '#7c4dff' },
  CYAN:   { base: '#4dd0e1', glow: '#00e5ff' },
  GREEN:  { base: '#a5d6a7', glow: '#69f0ae' },
  YELLOW: { base: '#fff176', glow: '#ffd600' },
  PURPLE: { base: '#ce93d8', glow: '#aa00ff' },
};

export function getBubbleTextureKey(color: BubbleColor): string {
  return `bubble_${color}`;
}

export function getShooterTextureKey(): string {
  return 'shooter';
}

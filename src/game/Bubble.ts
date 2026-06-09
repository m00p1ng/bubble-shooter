export type BubbleColor = 'RED' | 'BLUE' | 'GREEN' | 'YELLOW' | 'PURPLE' | 'CYAN';

export const ALL_COLORS: BubbleColor[] = ['RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE', 'CYAN'];

export type BubbleType = 'NORMAL' | 'STONE' | 'BOMB' | 'WILDCARD';

export const ALL_BUBBLE_TYPES: BubbleType[] = ['NORMAL', 'STONE', 'BOMB', 'WILDCARD'];

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

export const DEFAULT_HIT_POINTS: Record<BubbleType, number> = {
  NORMAL: 1,
  STONE: 2,
  BOMB: 1,
  WILDCARD: 1,
};

export interface GridCell {
  color: BubbleColor | null;
  type: BubbleType;
  hitPoints: number;
}

export type GridCellData = BubbleColor | { type: BubbleType; color?: BubbleColor } | null;

export function getBubbleTextureKey(
  color: BubbleColor,
  type: BubbleType = 'NORMAL',
): string {
  return type === 'NORMAL' ? `bubble_${color}` : `bubble_${type}_${color}`;
}

export function getShooterTextureKey(): string {
  return 'shooter';
}

export function getShooterCradleTextureKey(): string {
  return 'shooter_cradle';
}

export function parseGridCellData(data: unknown): GridCell | null {
  if (data === null) return null;

  if (typeof data === 'string') {
    if (!ALL_COLORS.includes(data as BubbleColor)) {
      throw new Error(`Unknown bubble color: ${data}`);
    }
    return {
      color: data as BubbleColor,
      type: 'NORMAL',
      hitPoints: DEFAULT_HIT_POINTS.NORMAL,
    };
  }

  if (typeof data === 'object') {
    const value = data as Record<string, unknown>;
    const type = value.type ?? 'NORMAL';
    const color = value.color ?? 'RED';

    if (!ALL_BUBBLE_TYPES.includes(type as BubbleType)) {
      throw new Error(`Unknown bubble type: ${String(type)}`);
    }
    if (!ALL_COLORS.includes(color as BubbleColor)) {
      throw new Error(`Unknown bubble color: ${String(color)}`);
    }

    return {
      color: color as BubbleColor,
      type: type as BubbleType,
      hitPoints: DEFAULT_HIT_POINTS[type as BubbleType],
    };
  }

  throw new Error(`Invalid grid cell data: ${String(data)}`);
}

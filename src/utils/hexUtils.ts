import {
  GRID_ORIGIN_X,
  GRID_ORIGIN_Y,
  COL_WIDTH,
  ROW_HEIGHT,
  GRID_COLS,
  GRID_ROWS,
  BUBBLE_RADIUS,
  DANGER_LINE_Y,
} from '../config';

export interface GridPos {
  row: number;
  col: number;
}

export function gridToPixel(row: number, col: number): { x: number; y: number } {
  const offsetX = row % 2 === 1 ? COL_WIDTH / 2 : 0;
  return {
    x: GRID_ORIGIN_X + col * COL_WIDTH + offsetX,
    y: GRID_ORIGIN_Y + row * ROW_HEIGHT,
  };
}

export function colsForRow(row: number): number {
  return row % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
}

export function pixelToNearestGrid(px: number, py: number): GridPos {
  const rawRow = Math.round((py - GRID_ORIGIN_Y) / ROW_HEIGHT);
  let bestDist = Infinity;
  let best: GridPos = { row: 0, col: 0 };

  for (let r = Math.max(0, rawRow - 1); r <= Math.min(GRID_ROWS - 1, rawRow + 1); r++) {
    const maxCol = colsForRow(r);
    const offsetX = r % 2 === 1 ? COL_WIDTH / 2 : 0;
    const rawCol = Math.round((px - GRID_ORIGIN_X - offsetX) / COL_WIDTH);
    const clampedCol = Math.max(0, Math.min(maxCol - 1, rawCol));
    const center = gridToPixel(r, clampedCol);
    const dist = Math.hypot(px - center.x, py - center.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = { row: r, col: clampedCol };
    }
  }
  return best;
}

export function getNeighbors(row: number, col: number): GridPos[] {
  const isOdd = row % 2 === 1;
  const candidates: GridPos[] = isOdd
    ? [
        { row: row - 1, col },
        { row: row - 1, col: col + 1 },
        { row, col: col - 1 },
        { row, col: col + 1 },
        { row: row + 1, col },
        { row: row + 1, col: col + 1 },
      ]
    : [
        { row: row - 1, col: col - 1 },
        { row: row - 1, col },
        { row, col: col - 1 },
        { row, col: col + 1 },
        { row: row + 1, col: col - 1 },
        { row: row + 1, col },
      ];

  return candidates.filter((c) => {
    if (c.row < 0 || c.row >= GRID_ROWS) return false;
    const maxCol = colsForRow(c.row);
    return c.col >= 0 && c.col < maxCol;
  });
}

export function isGridCellPastDangerLine(row: number, col: number): boolean {
  return gridToPixel(row, col).y + BUBBLE_RADIUS >= DANGER_LINE_Y;
}

export { GRID_ORIGIN_X, GRID_ORIGIN_Y, COL_WIDTH, ROW_HEIGHT, GRID_COLS, BUBBLE_RADIUS };

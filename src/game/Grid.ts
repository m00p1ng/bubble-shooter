import {
  DEFAULT_HIT_POINTS,
  parseGridCellData,
  type BubbleColor,
  type BubbleType,
  type GridCell,
  type GridCellData,
} from './Bubble';
import { GRID_COLS, GRID_ROWS } from '../config';

export type { GridCell } from './Bubble';

export class Grid {
  private cells: (GridCell | null)[][];
  readonly rows: number;
  readonly cols: number;

  constructor(rows = GRID_ROWS, cols = GRID_COLS) {
    this.rows = rows;
    this.cols = cols;
    this.cells = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: this.getColsForRow(r) }, () => this.emptyCell()),
    );
  }

  private emptyCell(): GridCell {
    return { color: null, type: 'NORMAL', hitPoints: DEFAULT_HIT_POINTS.NORMAL };
  }

  getColsForRow(row: number): number {
    return row % 2 === 0 ? this.cols : this.cols - 1;
  }

  getCell(row: number, col: number): GridCell | null {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.getColsForRow(row)) return null;
    return this.cells[row][col];
  }

  setCell(
    row: number,
    col: number,
    color: BubbleColor | null,
    type: BubbleType = 'NORMAL',
  ): void {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.getColsForRow(row)) return;
    this.cells[row][col] = { color, type, hitPoints: DEFAULT_HIT_POINTS[type] };
  }

  loadFromData(data: GridCellData[][]): void {
    data.forEach((rowData, r) => {
      if (r >= this.rows) return;
      rowData.forEach((cellData, c) => {
        if (c < this.getColsForRow(r)) {
          this.cells[r][c] = parseGridCellData(cellData) ?? this.emptyCell();
        }
      });
    });
  }

  damageCell(row: number, col: number): void {
    const cell = this.getCell(row, col);
    if (!cell?.color) return;

    cell.hitPoints--;
    if (cell.hitPoints <= 0) this.cells[row][col] = this.emptyCell();
  }

  private getNeighbors(row: number, col: number): Array<{ row: number; col: number }> {
    const isOdd = row % 2 === 1;
    const candidates = isOdd
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
      if (c.row < 0 || c.row >= this.rows) return false;
      return c.col >= 0 && c.col < this.getColsForRow(c.row);
    });
  }

  findMatch(
    row: number,
    col: number,
    effectiveColor?: BubbleColor,
  ): Array<{ row: number; col: number }> {
    const cell = this.getCell(row, col);
    if (!cell?.color || cell.type === 'STONE') return [];
    const target = effectiveColor ?? cell.color;
    const visited = new Set<string>();
    const queue: Array<{ row: number; col: number }> = [{ row, col }];
    const result: Array<{ row: number; col: number }> = [];

    while (queue.length > 0) {
      const cur = queue.shift()!;
      const key = `${cur.row},${cur.col}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const currentCell = this.getCell(cur.row, cur.col);
      if (!currentCell?.color || currentCell.type === 'STONE') continue;
      if (currentCell.type !== 'WILDCARD' && currentCell.color !== target) continue;
      result.push(cur);
      for (const n of this.getNeighbors(cur.row, cur.col)) {
        if (!visited.has(`${n.row},${n.col}`)) queue.push(n);
      }
    }
    return result;
  }

  findBestWildcardMatch(row: number, col: number): Array<{ row: number; col: number }> {
    const colors = new Set<BubbleColor>();

    for (const neighbor of this.getNeighbors(row, col)) {
      const cell = this.getCell(neighbor.row, neighbor.col);
      if (cell?.color && cell.type !== 'STONE' && cell.type !== 'WILDCARD') {
        colors.add(cell.color);
      }
    }

    let bestMatch: Array<{ row: number; col: number }> = [];
    for (const color of colors) {
      const match = this.findMatch(row, col, color);
      if (match.length > bestMatch.length) bestMatch = match;
    }

    return bestMatch.length > 0 ? bestMatch : [{ row, col }];
  }

  getCellsInRadius(
    row: number,
    col: number,
    radius: number,
  ): Array<{ row: number; col: number }> {
    if (!this.getCell(row, col)) return [];

    const result: Array<{ row: number; col: number }> = [{ row, col }];
    const visited = new Set([`${row},${col}`]);
    const queue: Array<{ row: number; col: number; distance: number }> = [
      { row, col, distance: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.distance >= radius) continue;

      for (const neighbor of this.getNeighbors(current.row, current.col)) {
        const key = `${neighbor.row},${neighbor.col}`;
        if (visited.has(key)) continue;
        visited.add(key);
        result.push(neighbor);
        queue.push({ ...neighbor, distance: current.distance + 1 });
      }
    }

    return result;
  }

  findOrphans(): Array<{ row: number; col: number }> {
    const connected = new Set<string>();
    const queue: Array<{ row: number; col: number }> = [];

    for (let c = 0; c < this.getColsForRow(0); c++) {
      if (this.cells[0][c]?.color) {
        queue.push({ row: 0, col: c });
        connected.add(`0,${c}`);
      }
    }

    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const n of this.getNeighbors(cur.row, cur.col)) {
        const key = `${n.row},${n.col}`;
        if (!connected.has(key) && this.getCell(n.row, n.col)?.color) {
          connected.add(key);
          queue.push(n);
        }
      }
    }

    const orphans: Array<{ row: number; col: number }> = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.getColsForRow(r); c++) {
        if (this.cells[r][c]?.color && !connected.has(`${r},${c}`)) {
          orphans.push({ row: r, col: c });
        }
      }
    }
    return orphans;
  }

  findEmptyNeighbors(
    cells: Array<{ row: number; col: number }>,
  ): Array<{ row: number; col: number }> {
    const empty = new Map<string, { row: number; col: number }>();

    for (const cell of cells) {
      for (const neighbor of this.getNeighbors(cell.row, cell.col)) {
        if (!this.getCell(neighbor.row, neighbor.col)?.color) {
          empty.set(`${neighbor.row},${neighbor.col}`, neighbor);
        }
      }
    }

    return [...empty.values()];
  }

  findNearestEmpty(
    starts: Array<{ row: number; col: number }>,
  ): { row: number; col: number } | null {
    const visited = new Set<string>();
    const queue = [...starts];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = `${current.row},${current.col}`;
      if (visited.has(key)) continue;
      visited.add(key);

      if (!this.getCell(current.row, current.col)?.color) return current;

      for (const neighbor of this.getNeighbors(current.row, current.col)) {
        if (!visited.has(`${neighbor.row},${neighbor.col}`)) {
          queue.push(neighbor);
        }
      }
    }

    return null;
  }

  countBubbles(): number {
    let n = 0;
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.getColsForRow(r); c++)
        if (this.cells[r][c]?.color) n++;
    return n;
  }

  isEmpty(): boolean {
    return this.countBubbles() === 0;
  }

  getActiveColors(): BubbleColor[] {
    const colors = new Set<BubbleColor>();
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.getColsForRow(r); c++) {
        const color = this.cells[r][c]?.color;
        if (color) colors.add(color);
      }
    return [...colors];
  }
}

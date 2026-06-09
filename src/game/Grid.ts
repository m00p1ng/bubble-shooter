import type { BubbleColor } from './Bubble';
import { GRID_COLS, GRID_ROWS } from '../config';

export interface GridCell {
  color: BubbleColor | null;
}

export class Grid {
  private cells: (GridCell | null)[][];
  readonly rows: number;
  readonly cols: number;

  constructor(rows = GRID_ROWS, cols = GRID_COLS) {
    this.rows = rows;
    this.cols = cols;
    this.cells = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: this.getColsForRow(r) }, () => ({ color: null })),
    );
  }

  getColsForRow(row: number): number {
    return row % 2 === 0 ? this.cols : this.cols - 1;
  }

  getCell(row: number, col: number): GridCell | null {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.getColsForRow(row)) return null;
    return this.cells[row][col];
  }

  setCell(row: number, col: number, color: BubbleColor | null): void {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.getColsForRow(row)) return;
    this.cells[row][col] = { color };
  }

  loadFromData(data: (BubbleColor | null)[][]): void {
    data.forEach((rowData, r) => {
      if (r >= this.rows) return;
      rowData.forEach((color, c) => {
        if (c < this.getColsForRow(r)) this.cells[r][c] = { color };
      });
    });
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

  findMatch(row: number, col: number): Array<{ row: number; col: number }> {
    const cell = this.getCell(row, col);
    if (!cell?.color) return [];
    const target = cell.color;
    const visited = new Set<string>();
    const queue: Array<{ row: number; col: number }> = [{ row, col }];
    const result: Array<{ row: number; col: number }> = [];

    while (queue.length > 0) {
      const cur = queue.shift()!;
      const key = `${cur.row},${cur.col}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (this.getCell(cur.row, cur.col)?.color !== target) continue;
      result.push(cur);
      for (const n of this.getNeighbors(cur.row, cur.col)) {
        if (!visited.has(`${n.row},${n.col}`)) queue.push(n);
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
}

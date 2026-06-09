export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 720;

export const BUBBLE_RADIUS = 22;
export const COL_WIDTH = BUBBLE_RADIUS * 2 + 2;   // 46 — diameter + 2px gap
export const ROW_HEIGHT = 40;                        // vertical center-to-center distance

export const GRID_COLS = 8;
export const GRID_ROWS = 10;

// Center of cell (0, 0): horizontally centers the 8-column even row
export const GRID_ORIGIN_X = Math.round((GAME_WIDTH - (GRID_COLS - 1) * COL_WIDTH) / 2); // 79
export const GRID_ORIGIN_Y = BUBBLE_RADIUS + 8;    // 30

// Danger line: if grid descends past this y, it's overflow
export const DANGER_LINE_Y = GRID_ORIGIN_Y + GRID_ROWS * ROW_HEIGHT; // 430

export const SHOOTER_X = GAME_WIDTH / 2;            // 240
export const SHOOTER_Y = GAME_HEIGHT - 80;          // 640

export const BUBBLE_SPEED = 800;                    // px/s
export const SHOOT_COOLDOWN = 300;                  // ms

export const MIN_SHOOT_ANGLE = (10 * Math.PI) / 180; // 10° from horizontal
export const MAX_TRAJECTORY_BOUNCES = 3;

export const MATCH_MIN = 3;                         // minimum bubbles to pop

export const SCORE_PER_POP = 100;
export const SCORE_PER_ORPHAN = 50;

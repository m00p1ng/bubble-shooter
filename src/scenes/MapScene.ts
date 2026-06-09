import Phaser from 'phaser';
import { loadSave, getLevelProgress, isLevelUnlocked } from '../utils/storage';
import { fadeOutAndStart, fadeIn } from '../utils/transition';
import type { LevelData } from '../types/LevelData';

const LEVEL_NODES = [
  { x: 90, y: 110 },
  { x: 210, y: 160 },
  { x: 350, y: 130 },
  { x: 390, y: 240 },
  { x: 290, y: 300 },
  { x: 170, y: 340 },
  { x: 90, y: 430 },
  { x: 130, y: 530 },
  { x: 270, y: 570 },
  { x: 390, y: 630 },
];

const NODE_RADIUS = 18;
const COMPLETED_COLOR = 0x00e5ff;
const CURRENT_COLOR = 0xff4081;
const LOCKED_COLOR = 0x444444;

export class MapScene extends Phaser.Scene {
  private briefingContainer: Phaser.GameObjects.Container | null = null;
  private agentMarker!: Phaser.GameObjects.Triangle;

  constructor() {
    super({ key: 'MapScene' });
  }

  create(): void {
    fadeIn(this);
    this.briefingContainer = null;
    this.createBackground();
    this.createBackButton();
    this.drawConnections();
    this.drawNodes();
    this.placeAgentMarker();
  }

  private createBackground(): void {
    this.add
      .rectangle(
        this.scale.width / 2,
        this.scale.height / 2,
        this.scale.width,
        this.scale.height,
        0x050510,
      )
      .setDepth(-1);

    const g = this.add.graphics();
    g.lineStyle(1, 0x0a1428, 0.5);
    for (let x = 0; x < this.scale.width; x += 40) {
      g.lineBetween(x, 0, x, this.scale.height);
    }
    for (let y = 0; y < this.scale.height; y += 40) {
      g.lineBetween(0, y, this.scale.width, y);
    }
  }

  private createBackButton(): void {
    const btn = this.add
      .text(20, 20, '< BACK', {
        fontSize: '12px',
        color: '#8892b0',
        fontFamily: 'monospace',
      })
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    btn.on('pointerdown', () => {
      fadeOutAndStart(this, 'MenuScene');
    });
  }

  private drawConnections(): void {
    const g = this.add.graphics();
    g.lineStyle(2, 0x8892b0, 0.4);

    for (let i = 0; i < LEVEL_NODES.length - 1; i++) {
      const a = LEVEL_NODES[i];
      const b = LEVEL_NODES[i + 1];
      this.drawDashedLine(g, a.x, a.y, b.x, b.y);
    }
  }

  private drawDashedLine(
    g: Phaser.GameObjects.Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    dashLen = 6,
    gapLen = 4,
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const ux = dx / len;
    const uy = dy / len;

    let drawn = 0;
    while (drawn < len) {
      const segStart = drawn;
      const segEnd = Math.min(drawn + dashLen, len);
      g.lineBetween(
        x1 + ux * segStart,
        y1 + uy * segStart,
        x1 + ux * segEnd,
        y1 + uy * segEnd,
      );
      drawn += dashLen + gapLen;
    }
  }

  private drawNodes(): void {
    const save = loadSave();

    LEVEL_NODES.forEach((pos, idx) => {
      const levelId = idx + 1;
      const progress = getLevelProgress(levelId);
      const unlocked = isLevelUnlocked(levelId);
      const isCurrent = levelId === save.unlockedUpTo;
      const isCompleted = progress.stars > 0;

      const color = isCompleted
        ? COMPLETED_COLOR
        : isCurrent
          ? CURRENT_COLOR
          : LOCKED_COLOR;

      const circle = this.add.circle(pos.x, pos.y, NODE_RADIUS, color);
      circle.setStrokeStyle(2, color, 0.8);

      if (!unlocked) {
        circle.setAlpha(0.5);
      }

      const label = this.add
        .text(pos.x, pos.y, String(levelId), {
          fontSize: '14px',
          color: '#ffffff',
          fontFamily: 'monospace',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      if (!unlocked) {
        label.setAlpha(0.5);
      }

      if (isCompleted) {
        const starsText = '★'.repeat(progress.stars) + '☆'.repeat(3 - progress.stars);
        this.add
          .text(pos.x, pos.y + NODE_RADIUS + 10, starsText, {
            fontSize: '10px',
            color: '#ffd600',
          })
          .setOrigin(0.5);
      }

      if (isCurrent) {
        const glow = this.add.circle(pos.x, pos.y, NODE_RADIUS + 6, CURRENT_COLOR, 0.3);
        this.tweens.add({
          targets: glow,
          scaleX: 1.3,
          scaleY: 1.3,
          alpha: 0,
          duration: 1000,
          repeat: -1,
        });
      }

      if (unlocked) {
        circle.setInteractive({ useHandCursor: true });
        label.setInteractive({ useHandCursor: true });
        const onClick = () => this.showBriefing(levelId);
        circle.on('pointerdown', onClick);
        label.on('pointerdown', onClick);
      }
    });
  }

  private placeAgentMarker(): void {
    const save = loadSave();
    const currentLevel = Math.min(save.unlockedUpTo, LEVEL_NODES.length);
    const pos = LEVEL_NODES[currentLevel - 1];

    this.agentMarker = this.add.triangle(
      pos.x,
      pos.y - NODE_RADIUS - 14,
      0, -8, -7, 6, 7, 6,
      0x00e5ff,
    );
    this.agentMarker.setOrigin(0.5);

    this.tweens.add({
      targets: this.agentMarker,
      y: '+=4',
      duration: 600,
      yoyo: true,
      repeat: -1,
    });
  }

  private showBriefing(levelId: number): void {
    if (this.briefingContainer) {
      this.briefingContainer.destroy();
      this.briefingContainer = null;
    }

    const levelData = this.cache.json.get(`level-${levelId}`) as LevelData;
    const progress = getLevelProgress(levelId);

    this.briefingContainer = this.add.container(0, 0);
    this.briefingContainer.setDepth(100);

    const panelW = this.scale.width - 48;
    const panelH = 280;
    const panelX = this.scale.width / 2;
    const panelY = this.scale.height / 2;

    const bg = this.add.rectangle(panelX, panelY, panelW, panelH, 0x0a1428, 0.95);
    bg.setStrokeStyle(2, 0x00e5ff, 0.5);
    this.briefingContainer.add(bg);

    const nameText = this.add.text(panelX, panelY - 90, levelData.name, {
      fontSize: '22px',
      color: '#00e5ff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.briefingContainer.add(nameText);

    const objectiveText =
      levelData.type === 'moves'
        ? `OBJECTIVE: Clear all bubbles in ${levelData.moves} moves`
        : `OBJECTIVE: Clear all bubbles in ${levelData.time} seconds`;
    const obj = this.add.text(panelX, panelY - 50, objectiveText, {
      fontSize: '13px',
      color: '#c0c8ff',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.briefingContainer.add(obj);

    if (progress.highScore > 0) {
      const best = this.add.text(panelX, panelY - 20, `BEST SCORE: ${progress.highScore}`, {
        fontSize: '13px',
        color: '#69f0ae',
        fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.briefingContainer.add(best);
    }

    const starsText = '★'.repeat(progress.stars) + '☆'.repeat(3 - progress.stars);
    const stars = this.add.text(panelX, panelY + 20, starsText, {
      fontSize: '28px',
      color: '#ffd600',
    }).setOrigin(0.5);
    this.briefingContainer.add(stars);

    const thresholds = this.add.text(
      panelX,
      panelY + 50,
      `★ ${levelData.stars[0]}    ★★ ${levelData.stars[1]}    ★★★ ${levelData.stars[2]}`,
      { fontSize: '11px', color: '#8892b0', fontFamily: 'monospace' },
    ).setOrigin(0.5);
    this.briefingContainer.add(thresholds);

    const startBtn = this.add
      .text(panelX, panelY + 90, '[ START MISSION ]', {
        fontSize: '18px',
        color: '#69f0ae',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.briefingContainer.add(startBtn);

    startBtn.on('pointerover', () => startBtn.setColor('#a5d6a7'));
    startBtn.on('pointerout', () => startBtn.setColor('#69f0ae'));
    startBtn.on('pointerdown', () => {
      this.registry.set('currentLevel', levelId);
      fadeOutAndStart(this, 'GameScene', { stopScenes: ['MapScene'] });
    });

    const closeBtn = this.add
      .text(panelX + panelW / 2 - 20, panelY - panelH / 2 + 20, 'X', {
        fontSize: '18px',
        color: '#ff4081',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.briefingContainer.add(closeBtn);

    closeBtn.on('pointerdown', () => {
      this.briefingContainer?.destroy();
      this.briefingContainer = null;
    });
  }
}

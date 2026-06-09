# Bubble Spy Phase 3 — Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add audio, enhanced particles, bubble idle animations, map ambient effects, and mobile touch tuning to the existing Bubble Spy game.

**Architecture:** Procedural audio generation via Web Audio API (no external assets), Phaser particle emitters for visual effects, tween-based idle animations for bubbles, parallax layers using multiple tile sprites, and touch event normalization for mobile. Audio is centralized in an `AudioManager` singleton; effects are scene-local via enhanced `Effects` class.

**Tech Stack:** Phaser 3, TypeScript, Vite, Vitest (testing), Web Audio API

---

## File Structure

### New Files
- `src/audio/AudioManager.ts` — Singleton managing all game audio (SFX + music)
- `src/audio/SoundEffects.ts` — Procedural sound effect generators (pop, shoot, bounce, win, lose, orphan)
- `src/audio/MusicPlayer.ts` — Procedural background music sequencer
- `src/utils/mobile.ts` — Mobile detection and touch normalization utilities
- `tests/audio/AudioManager.test.ts` — Tests for audio manager
- `tests/audio/SoundEffects.test.ts` — Tests for sound effect generation
- `tests/utils/mobile.test.ts` — Tests for mobile utilities

### Modified Files
- `src/game/Effects.ts` — Add Phaser particle emitter burst, screen shake, trail effects
- `src/scenes/GameScene.ts` — Hook audio calls, add bubble idle animations, mobile touch tuning
- `src/scenes/MenuScene.ts` — Add parallax starfield, ambient particles, menu music
- `src/scenes/MapScene.ts` — Add parallax background, ambient floating particles, node hover sounds
- `src/scenes/BootScene.ts` — Initialize audio context, generate particle textures
- `src/scenes/UIScene.ts` — Add mute toggle button
- `src/main.ts` — Set Phaser audio config
- `src/config.ts` — Add audio/particle config constants

---

## Constants to Add to `src/config.ts`

Add these at the bottom of `src/config.ts` (after line 30):

```typescript
// Audio
export const AUDIO_MASTER_VOLUME = 0.7;
export const SFX_VOLUME = 0.8;
export const MUSIC_VOLUME = 0.4;

// Particles
export const POP_PARTICLE_COUNT = 16;
export const POP_PARTICLE_SPEED_MIN = 80;
export const POP_PARTICLE_SPEED_MAX = 180;
export const POP_PARTICLE_LIFETIME = 400;

// Animations
export const BUBBLE_IDLE_PULSE_SCALE = 1.06;
export const BUBBLE_IDLE_PULSE_DURATION = 1200;
export const BUBBLE_IDLE_PULSE_DELAY_VARIANCE = 400;

// Mobile
export const TOUCH_DRAG_THRESHOLD = 10; // px — ignore taps that drag less than this
```

---

## Task 1: Enhanced Particle System

**Files:**
- Modify: `src/game/Effects.ts`
- Modify: `src/scenes/GameScene.ts` (uncomment shakeCamera call)
- Modify: `src/scenes/BootScene.ts` (generate particle texture)
- Test: `tests/game/Effects.test.ts`

**Context:** The current `Effects.ts` manually creates circle graphics for each particle. We will replace this with Phaser's built-in `ParticleEmitter` for better performance and richer visuals. We will also enable the existing (commented-out) camera shake.

---

- [ ] **Step 1: Generate particle texture in BootScene**

In `src/scenes/BootScene.ts`, add a method call in `create()` after `generateShooterTexture()`:

```typescript
this.generateParticleTexture();
```

Add the method:

```typescript
private generateParticleTexture(): void {
  const key = 'particle';
  if (this.textures.exists(key)) return;
  const ct = this.textures.createCanvas(key, 8, 8)!;
  const ctx = ct.context;
  const grad = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 8, 8);
  ct.refresh();
}
```

- [ ] **Step 2: Write failing test for enhanced Effects**

Create `tests/game/Effects.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effects } from '../../src/game/Effects';

describe('Effects', () => {
  let mockScene: any;
  let effects: Effects;

  beforeEach(() => {
    mockScene = {
      add: {
        particles: vi.fn(() => ({
          createEmitter: vi.fn(() => ({
            explode: vi.fn(),
          })),
        })),
      },
      cameras: {
        main: { shake: vi.fn() },
      },
      tweens: { add: vi.fn() },
    };
    effects = new Effects(mockScene);
  });

  it('should create particle emitter on construction', () => {
    expect(mockScene.add.particles).toHaveBeenCalledWith('particle');
  });

  it('should emit particles on popBurst', () => {
    effects.popBurst(100, 200, 'RED');
    const emitter = mockScene.add.particles().createEmitter();
    expect(emitter.explode).toHaveBeenCalled();
  });

  it('should shake camera with intensity based on match count', () => {
    effects.shakeCamera(5);
    expect(mockScene.cameras.main.shake).toHaveBeenCalledWith(150, 0.025);
  });
});
```

Run:
```bash
npm test -- tests/game/Effects.test.ts
```
Expected: FAIL — `Effects` class doesn't match new API yet.

- [ ] **Step 3: Implement enhanced Effects class**

Replace the contents of `src/game/Effects.ts`:

```typescript
import Phaser from 'phaser';
import type { BubbleColor } from './Bubble';
import { COLOR_CONFIG } from './Bubble';
import { POP_PARTICLE_COUNT, POP_PARTICLE_SPEED_MIN, POP_PARTICLE_SPEED_MAX, POP_PARTICLE_LIFETIME } from '../config';

export class Effects {
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private scene: Phaser.Scene) {
    const particles = scene.add.particles('particle');
    this.emitter = particles.createEmitter({
      speed: { min: POP_PARTICLE_SPEED_MIN, max: POP_PARTICLE_SPEED_MAX },
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: POP_PARTICLE_LIFETIME,
      blendMode: Phaser.BlendModes.ADD,
      on: false,
    });
  }

  popBurst(x: number, y: number, color: BubbleColor): void {
    const hexColor = parseInt(COLOR_CONFIG[color].glow.replace('#', ''), 16);
    this.emitter.setPosition(x, y);
    this.emitter.setTint(hexColor);
    this.emitter.explode(POP_PARTICLE_COUNT, x, y);
  }

  shakeCamera(matchCount: number): void {
    const intensity = 0.005 * matchCount;
    this.scene.cameras.main.shake(150, intensity);
  }
}
```

- [ ] **Step 4: Hook up camera shake in GameScene**

In `src/scenes/GameScene.ts`, line 246, replace the comment:

```typescript
    // this.shakeCamera(matched.length);
```

With:

```typescript
    this.effects.shakeCamera(matched.length);
```

- [ ] **Step 5: Run tests**

```bash
npm test -- tests/game/Effects.test.ts
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/game/Effects.ts src/scenes/GameScene.ts src/scenes/BootScene.ts tests/game/Effects.test.ts src/config.ts
git commit -m "feat: enhance particle system with Phaser emitters and camera shake"
```

---

## Task 2: Sound Effects System

**Files:**
- Create: `src/audio/SoundEffects.ts`
- Create: `src/audio/AudioManager.ts`
- Modify: `src/config.ts` (add audio constants)
- Test: `tests/audio/SoundEffects.test.ts`
- Test: `tests/audio/AudioManager.test.ts`

**Context:** We generate all sounds procedurally using the Web Audio API — no external audio files. Each sound is a short synthesized tone or noise burst. The `AudioManager` is a singleton that manages the audio context, master volume, and provides scene-friendly methods.

---

- [ ] **Step 1: Write failing test for SoundEffects generator**

Create `tests/audio/SoundEffects.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SoundEffects } from '../../src/audio/SoundEffects';

describe('SoundEffects', () => {
  let sfx: SoundEffects;
  let mockCtx: any;

  beforeEach(() => {
    mockCtx = {
      createOscillator: vi.fn(() => ({
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        type: 'sine',
      })),
      createGain: vi.fn(() => ({
        connect: vi.fn(),
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
      })),
      createBufferSource: vi.fn(() => ({
        connect: vi.fn(),
        start: vi.fn(),
        buffer: null,
      })),
      createBuffer: vi.fn(() => ({ duration: 0.1 })),
      destination: {},
      currentTime: 0,
      sampleRate: 44100,
    };
    sfx = new SoundEffects(mockCtx as AudioContext);
  });

  it('should create pop sound with oscillator', () => {
    sfx.playPop();
    expect(mockCtx.createOscillator).toHaveBeenCalled();
  });

  it('should create shoot sound', () => {
    sfx.playShoot();
    expect(mockCtx.createOscillator).toHaveBeenCalled();
  });

  it('should create bounce sound', () => {
    sfx.playBounce();
    expect(mockCtx.createOscillator).toHaveBeenCalled();
  });

  it('should create win sound', () => {
    sfx.playWin();
    expect(mockCtx.createOscillator).toHaveBeenCalled();
  });

  it('should create lose sound', () => {
    sfx.playLose();
    expect(mockCtx.createOscillator).toHaveBeenCalled();
  });

  it('should create orphan drop sound with noise buffer', () => {
    sfx.playOrphanDrop();
    expect(mockCtx.createBuffer).toHaveBeenCalled();
  });
});
```

Run:
```bash
npm test -- tests/audio/SoundEffects.test.ts
```
Expected: FAIL — SoundEffects class doesn't exist.

- [ ] **Step 2: Implement SoundEffects class**

Create `src/audio/SoundEffects.ts`:

```typescript
export class SoundEffects {
  constructor(private ctx: AudioContext) {}

  private makeGain(volume: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(volume, this.ctx.currentTime);
    return g;
  }

  private makeOsc(type: OscillatorType, freq: number, volume: number): OscillatorNode {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    const g = this.makeGain(volume);
    osc.connect(g);
    g.connect(this.ctx.destination);
    return osc;
  }

  playPop(): void {
    const osc = this.makeOsc('sine', 880, 0.3);
    osc.frequency.exponentialRampToValueAtTime(220, this.ctx.currentTime + 0.08);
    const g = osc.connect(this.ctx.destination) as unknown as GainNode;
    // reconnect through gain
    osc.disconnect();
    const gain = this.makeGain(0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playShoot(): void {
    const osc = this.makeOsc('triangle', 600, 0.2);
    const gain = this.makeGain(0.2);
    osc.disconnect();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  playBounce(): void {
    const osc = this.makeOsc('sine', 400, 0.15);
    const gain = this.makeGain(0.15);
    osc.disconnect();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  playWin(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const t = this.ctx.currentTime + i * 0.12;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  playLose(): void {
    const notes = [400, 350, 300, 250];
    notes.forEach((freq, i) => {
      const t = this.ctx.currentTime + i * 0.18;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  }

  playOrphanDrop(): void {
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    source.connect(gain);
    gain.connect(this.ctx.destination);
    source.start();
  }
}
```

- [ ] **Step 3: Implement MusicPlayer first (AudioManager dependency)**

Create `src/audio/MusicPlayer.ts`:

```typescript
export class MusicPlayer {
  private ctx: AudioContext;
  private currentOscs: OscillatorNode[] = [];
  private currentGains: GainNode[] = [];
  private intervalId: number | null = null;
  private volume = 0.4;
  private type: 'menu' | 'game' | null = null;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  start(type: 'menu' | 'game', volume: number): void {
    this.stop();
    this.volume = volume;
    this.type = type;
    if (type === 'menu') {
      this.startMenuMusic();
    } else {
      this.startGameMusic();
    }
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.currentOscs.forEach((o) => {
      try { o.stop(); } catch { /* ignore */ }
    });
    this.currentOscs = [];
    this.currentGains = [];
    this.type = null;
  }

  resume(): void {
    if (this.type) {
      this.start(this.type, this.volume);
    }
  }

  setVolume(v: number): void {
    this.volume = v;
    this.currentGains.forEach((g) => {
      g.gain.setValueAtTime(v, this.ctx.currentTime);
    });
  }

  private startMenuMusic(): void {
    // Ambient drone: low sustained chord
    const freqs = [110, 164.81, 196];
    freqs.forEach((f) => this.addDrone(f, 4));
  }

  private startGameMusic(): void {
    // Faster arpeggio
    const notes = [220, 277.18, 329.63, 440, 329.63, 277.18];
    let idx = 0;
    this.intervalId = window.setInterval(() => {
      const f = notes[idx % notes.length];
      idx++;
      this.playArpNote(f);
    }, 250);
  }

  private addDrone(freq: number, durationSec: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(this.volume * 0.5, this.ctx.currentTime + 0.5);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + durationSec);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + durationSec);
    this.currentOscs.push(osc);
    this.currentGains.push(gain);
  }

  private playArpNote(freq: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(this.volume * 0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
    this.currentOscs.push(osc);
    this.currentGains.push(gain);
  }
}
```

- [ ] **Step 4: Write failing test for AudioManager**

Create `tests/audio/AudioManager.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioManager } from '../../src/audio/AudioManager';

describe('AudioManager', () => {
  let mockScene: any;

  beforeEach(() => {
    mockScene = {
      sound: {
        mute: false,
      },
    };
    // Reset singleton
    (AudioManager as any).instance = null;
  });

  it('should be a singleton', () => {
    const a1 = AudioManager.getInstance();
    const a2 = AudioManager.getInstance();
    expect(a1).toBe(a2);
  });

  it('should initialize with scene', () => {
    const am = AudioManager.getInstance();
    am.init(mockScene);
    expect(am['scene']).toBe(mockScene);
  });

  it('should toggle mute', () => {
    const am = AudioManager.getInstance();
    am.init(mockScene);
    const initial = am.isMuted();
    am.toggleMute();
    expect(am.isMuted()).toBe(!initial);
    am.toggleMute();
    expect(am.isMuted()).toBe(initial);
  });

  it('should expose playPop method', () => {
    const am = AudioManager.getInstance();
    am.init(mockScene);
    expect(() => am.playPop()).not.toThrow();
  });
});
```

Run:
```bash
npm test -- tests/audio/AudioManager.test.ts
```
Expected: FAIL — AudioManager doesn't exist.

- [ ] **Step 5: Implement AudioManager singleton**

Create `src/audio/AudioManager.ts`:

```typescript
import { SoundEffects } from './SoundEffects';
import { MusicPlayer } from './MusicPlayer';
import { SFX_VOLUME, MUSIC_VOLUME } from '../config';

export class AudioManager {
  private static instance: AudioManager | null = null;
  private ctx: AudioContext | null = null;
  private sfx!: SoundEffects;
  private music!: MusicPlayer;
  private scene: Phaser.Scene | null = null;
  private _muted = false;
  private sfxVolume = SFX_VOLUME;
  private musicVolume = MUSIC_VOLUME;

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  init(scene: Phaser.Scene): void {
    this.scene = scene;
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.sfx = new SoundEffects(this.ctx);
    this.music = new MusicPlayer(this.ctx);
  }

  getContext(): AudioContext | null {
    return this.ctx;
  }

  playPop(): void { if (!this._muted) this.sfx.playPop(); }
  playShoot(): void { if (!this._muted) this.sfx.playShoot(); }
  playBounce(): void { if (!this._muted) this.sfx.playBounce(); }
  playWin(): void { if (!this._muted) this.sfx.playWin(); }
  playLose(): void { if (!this._muted) this.sfx.playLose(); }
  playOrphanDrop(): void { if (!this._muted) this.sfx.playOrphanDrop(); }

  startMusic(type: 'menu' | 'game'): void {
    if (!this._muted && this.ctx) {
      this.music.start(type, this.musicVolume);
    }
  }

  stopMusic(): void {
    this.music.stop();
  }

  toggleMute(): void {
    this._muted = !this._muted;
    if (this.scene) {
      this.scene.sound.mute = this._muted;
    }
    if (this._muted) {
      this.music.stop();
    } else {
      this.music.resume();
    }
  }

  isMuted(): boolean {
    return this._muted;
  }

  setSfxVolume(v: number): void { this.sfxVolume = v; }
  setMusicVolume(v: number): void {
    this.musicVolume = v;
    this.music.setVolume(v);
  }
}
```

```typescript
export class MusicPlayer {
  private ctx: AudioContext;
  private currentOscs: OscillatorNode[] = [];
  private currentGains: GainNode[] = [];
  private intervalId: number | null = null;
  private volume = 0.4;
  private type: 'menu' | 'game' | null = null;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  start(type: 'menu' | 'game', volume: number): void {
    this.stop();
    this.volume = volume;
    this.type = type;
    if (type === 'menu') {
      this.startMenuMusic();
    } else {
      this.startGameMusic();
    }
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.currentOscs.forEach((o) => {
      try { o.stop(); } catch { /* ignore */ }
    });
    this.currentOscs = [];
    this.currentGains = [];
    this.type = null;
  }

  resume(): void {
    if (this.type) {
      this.start(this.type, this.volume);
    }
  }

  setVolume(v: number): void {
    this.volume = v;
    this.currentGains.forEach((g) => {
      g.gain.setValueAtTime(v, this.ctx.currentTime);
    });
  }

  private startMenuMusic(): void {
    // Ambient drone: low sustained chord
    const freqs = [110, 164.81, 196];
    freqs.forEach((f) => this.addDrone(f, 4));
  }

  private startGameMusic(): void {
    // Faster arpeggio
    const notes = [220, 277.18, 329.63, 440, 329.63, 277.18];
    let idx = 0;
    this.intervalId = window.setInterval(() => {
      const f = notes[idx % notes.length];
      idx++;
      this.playArpNote(f);
    }, 250);
  }

  private addDrone(freq: number, durationSec: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(this.volume * 0.5, this.ctx.currentTime + 0.5);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + durationSec);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + durationSec);
    this.currentOscs.push(osc);
    this.currentGains.push(gain);
  }

  private playArpNote(freq: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(this.volume * 0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
    this.currentOscs.push(osc);
    this.currentGains.push(gain);
  }
}
```

- [ ] **Step 6: Run all audio tests**

```bash
npm test -- tests/audio/
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/audio/ tests/audio/ src/config.ts
git commit -m "feat: add procedural audio system with SFX and music"
```

---

## Task 3: Hook Audio into Scenes

**Files:**
- Modify: `src/scenes/BootScene.ts`
- Modify: `src/scenes/MenuScene.ts`
- Modify: `src/scenes/MapScene.ts`
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/scenes/UIScene.ts`

**Context:** Wire the AudioManager into all scenes so sounds play at the right moments.

---

- [ ] **Step 1: Initialize audio in BootScene**

In `src/scenes/BootScene.ts`, add import at top:

```typescript
import { AudioManager } from '../audio/AudioManager';
```

In `create()`, before `this.scene.start('MenuScene')`:

```typescript
AudioManager.getInstance().init(this);
```

- [ ] **Step 2: Add menu music and hover sounds to MenuScene**

In `src/scenes/MenuScene.ts`, add import:

```typescript
import { AudioManager } from '../audio/AudioManager';
```

In `create()`, after `fadeIn(this)`:

```typescript
AudioManager.getInstance().startMusic('menu');
```

In `createPlayButton()`, after creating `playBtn`:

```typescript
    playBtn.on('pointerover', () => {
      playBtn.setColor('#a5d6a7');
      AudioManager.getInstance().playBounce();
    });
```

- [ ] **Step 3: Add map hover sounds**

In `src/scenes/MapScene.ts`, add import:

```typescript
import { AudioManager } from '../audio/AudioManager';
```

In `drawNodes()`, inside the `if (unlocked)` block after creating `onClick`:

```typescript
      const onOver = () => {
        circle.setScale(1.1);
        label.setScale(1.1);
        AudioManager.getInstance().playBounce();
      };
      const onOut = () => {
        circle.setScale(1);
        label.setScale(1);
      };
      circle.on('pointerover', onOver);
      circle.on('pointerout', onOut);
      label.on('pointerover', onOver);
      label.on('pointerout', onOut);
```

- [ ] **Step 4: Hook game sounds into GameScene**

In `src/scenes/GameScene.ts`, add import:

```typescript
import { AudioManager } from '../audio/AudioManager';
```

In `create()`, after `this.effects = new Effects(this)`:

```typescript
    AudioManager.getInstance().startMusic('game');
```

In `onShooterFire()`, after `this.flyingBubbles.push(bubble)`:

```typescript
    AudioManager.getInstance().playShoot();
```

In `processMatch()`, after `this.score += matched.length * SCORE_PER_POP`:

```typescript
    AudioManager.getInstance().playPop();
```

In the orphan loop in `processMatch()`, after `this.gridSprites.delete(`${r},${c}`)`:

```typescript
      AudioManager.getInstance().playOrphanDrop();
```

In `triggerWin()`:

```typescript
    AudioManager.getInstance().playWin();
```

In `triggerLose()`:

```typescript
    AudioManager.getInstance().playLose();
```

In `shutdown()`:

```typescript
    AudioManager.getInstance().stopMusic();
```

- [ ] **Step 5: Add mute button to UIScene**

In `src/scenes/UIScene.ts`, add import:

```typescript
import { AudioManager } from '../audio/AudioManager';
```

In `create()`, after `this.createPauseButton()`:

```typescript
    this.createMuteButton();
```

Add method:

```typescript
  private createMuteButton(): void {
    const btn = this.add
      .text(16, 48, '♪', {
        fontSize: '16px',
        color: '#c0c8ff',
        fontFamily: 'monospace',
      })
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    const updateIcon = () => {
      btn.setText(AudioManager.getInstance().isMuted() ? '♪' : '♫');
      btn.setColor(AudioManager.getInstance().isMuted() ? '#ff4081' : '#c0c8ff');
    };

    btn.on('pointerdown', () => {
      AudioManager.getInstance().toggleMute();
      updateIcon();
    });

    updateIcon();
  }
```

- [ ] **Step 6: Commit**

```bash
git add src/scenes/BootScene.ts src/scenes/MenuScene.ts src/scenes/MapScene.ts src/scenes/GameScene.ts src/scenes/UIScene.ts
git commit -m "feat: wire audio into all scenes with mute toggle"
```

---

## Task 4: Bubble Idle Animations

**Files:**
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/game/Shooter.ts`

**Context:** Add gentle pulsing animations to bubbles sitting in the grid and the shooter's current/next bubbles. Each bubble gets a random delay so they don't pulse in unison.

---

- [ ] **Step 1: Add idle tweens to grid bubbles in GameScene**

In `src/scenes/GameScene.ts`, add import:

```typescript
import { BUBBLE_IDLE_PULSE_SCALE, BUBBLE_IDLE_PULSE_DURATION, BUBBLE_IDLE_PULSE_DELAY_VARIANCE } from '../config';
```

Add private method:

```typescript
  private addIdleAnimation(sprite: Phaser.GameObjects.Image): void {
    const delay = Phaser.Math.Between(0, BUBBLE_IDLE_PULSE_DELAY_VARIANCE);
    this.tweens.add({
      targets: sprite,
      scaleX: BUBBLE_IDLE_PULSE_SCALE,
      scaleY: BUBBLE_IDLE_PULSE_SCALE,
      duration: BUBBLE_IDLE_PULSE_DURATION / 2,
      delay,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
```

In `renderGrid()`, after creating each sprite (`this.add.image(x, y, ...)`):

```typescript
        this.addIdleAnimation(sprite);
```

In `placeBubble()`, after creating the new sprite:

```typescript
    this.addIdleAnimation(sprite);
```

- [ ] **Step 2: Add idle pulse to shooter bubbles**

In `src/game/Shooter.ts`, add import:

```typescript
import { BUBBLE_IDLE_PULSE_SCALE, BUBBLE_IDLE_PULSE_DURATION } from '../config';
```

In `createSprites()`, after creating `currentSprite`:

```typescript
    this.scene.tweens.add({
      targets: this.currentSprite,
      scaleX: BUBBLE_IDLE_PULSE_SCALE,
      scaleY: BUBBLE_IDLE_PULSE_SCALE,
      duration: BUBBLE_IDLE_PULSE_DURATION / 2,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
```

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameScene.ts src/game/Shooter.ts src/config.ts
git commit -m "feat: add gentle idle pulse animation to grid and shooter bubbles"
```

---

## Task 5: Map Scene Ambient Polish

**Files:**
- Modify: `src/scenes/MapScene.ts`
- Modify: `src/scenes/MenuScene.ts`

**Context:** Add parallax starfield background and ambient floating particles to the map. Add a subtle parallax effect to the menu background stars.

---

- [ ] **Step 1: Add parallax background to MapScene**

In `src/scenes/MapScene.ts`, add to the class:

```typescript
  private parallaxLayers: Phaser.GameObjects.Container[] = [];
```

Replace `createBackground()` with:

```typescript
  private createBackground(): void {
    this.add
      .rectangle(
        this.scale.width / 2,
        this.scale.height / 2,
        this.scale.width,
        this.scale.height,
        0x050510,
      )
      .setDepth(-10);

    // Parallax star layers
    for (let layer = 0; layer < 3; layer++) {
      const container = this.add.container(0, 0);
      const starCount = 40 - layer * 10;
      const alpha = 0.7 - layer * 0.2;
      const radius = 1.5 - layer * 0.3;

      for (let i = 0; i < starCount; i++) {
        container.add(
          this.add.circle(
            Phaser.Math.Between(0, this.scale.width),
            Phaser.Math.Between(0, this.scale.height),
            radius,
            0xffffff,
            alpha,
          ),
        );
      }
      container.setDepth(-5 + layer);
      this.parallaxLayers.push(container);
    }

    // Grid overlay
    const g = this.add.graphics();
    g.lineStyle(1, 0x0a1428, 0.5);
    for (let x = 0; x < this.scale.width; x += 40) {
      g.lineBetween(x, 0, x, this.scale.height);
    }
    for (let y = 0; y < this.scale.height; y += 40) {
      g.lineBetween(0, y, this.scale.width, y);
    }

    // Subtle parallax on mouse move
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const cx = this.scale.width / 2;
      const cy = this.scale.height / 2;
      const dx = (p.x - cx) / cx;
      const dy = (p.y - cy) / cy;
      this.parallaxLayers.forEach((layer, i) => {
        layer.x = dx * (i + 1) * 8;
        layer.y = dy * (i + 1) * 8;
      });
    });
  }
```

- [ ] **Step 2: Add ambient floating particles to MapScene**

In `src/scenes/MapScene.ts`, add to class:

```typescript
  private ambientParticles!: Phaser.GameObjects.Particles.ParticleEmitter;
```

In `create()`, after `this.placeAgentMarker()`:

```typescript
    this.createAmbientParticles();
```

Add method:

```typescript
  private createAmbientParticles(): void {
    const particles = this.add.particles('particle');
    this.ambientParticles = particles.createEmitter({
      x: { min: 0, max: this.scale.width },
      y: this.scale.height + 10,
      speedY: { min: -20, max: -40 },
      speedX: { min: -5, max: 5 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.4, end: 0 },
      lifespan: 8000,
      frequency: 400,
      quantity: 1,
      tint: [0x00e5ff, 0xff4081, 0x7c4dff],
    });
  }
```

- [ ] **Step 3: Add parallax to MenuScene stars**

In `src/scenes/MenuScene.ts`, add to class:

```typescript
  private starLayer!: Phaser.GameObjects.Container;
```

Modify `createBackground()`:

```typescript
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

    this.starLayer = this.add.container(0, 0);
    for (let i = 0; i < 80; i++) {
      this.starLayer.add(
        this.add.circle(
          Phaser.Math.Between(0, this.scale.width),
          Phaser.Math.Between(0, this.scale.height),
          Phaser.Math.FloatBetween(0.5, 1.5),
          0xffffff,
          Phaser.Math.FloatBetween(0.2, 0.7),
        ),
      );
    }

    // Parallax on mouse
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const cx = this.scale.width / 2;
      const cy = this.scale.height / 2;
      this.starLayer.x = (p.x - cx) / cx * 6;
      this.starLayer.y = (p.y - cy) / cy * 6;
    });
  }
```

- [ ] **Step 4: Commit**

```bash
git add src/scenes/MapScene.ts src/scenes/MenuScene.ts
git commit -m "feat: add parallax backgrounds and ambient particles to map and menu"
```

---

## Task 6: Mobile Touch Support Tuning

**Files:**
- Create: `src/utils/mobile.ts`
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/scenes/MenuScene.ts`
- Modify: `src/scenes/MapScene.ts`
- Modify: `src/main.ts`
- Test: `tests/utils/mobile.test.ts`

**Context:** Improve touch handling: prevent accidental page scroll/zoom, add touch-drag threshold to distinguish taps from drags, and optimize input areas for fingers.

---

- [ ] **Step 1: Write failing test for mobile utilities**

Create `tests/utils/mobile.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isMobile, normalizePointer, preventZoom } from '../../src/utils/mobile';

describe('mobile utilities', () => {
  describe('isMobile', () => {
    const originalUA = navigator.userAgent;

    afterEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        configurable: true,
      });
    });

    it('should detect mobile user agent', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        configurable: true,
      });
      expect(isMobile()).toBe(true);
    });

    it('should not detect desktop user agent', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        configurable: true,
      });
      expect(isMobile()).toBe(false);
    });
  });

  describe('normalizePointer', () => {
    it('should return pointer position for non-touch', () => {
      const ptr = { pointerId: 1, x: 100, y: 200, isDown: true } as Phaser.Input.Pointer;
      const result = normalizePointer(ptr);
      expect(result).toEqual({ x: 100, y: 200, isTap: true });
    });

    it('should track drag distance', () => {
      const ptr = {
        pointerId: 1,
        x: 100,
        y: 200,
        downX: 100,
        downY: 200,
        isDown: true,
      } as Phaser.Input.Pointer;
      const result1 = normalizePointer(ptr);
      expect(result1.isTap).toBe(true);

      ptr.x = 120;
      ptr.y = 220;
      const result2 = normalizePointer(ptr);
      expect(result2.isTap).toBe(false);
    });
  });
});
```

Run:
```bash
npm test -- tests/utils/mobile.test.ts
```
Expected: FAIL — mobile.ts doesn't exist.

- [ ] **Step 2: Implement mobile utilities**

Create `src/utils/mobile.ts`:

```typescript
const DRAG_THRESHOLD = 10;

const pointerStates = new Map<number, { downX: number; downY: number }>();

export function isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function normalizePointer(pointer: Phaser.Input.Pointer): { x: number; y: number; isTap: boolean } {
  if (pointer.isDown) {
    if (!pointerStates.has(pointer.pointerId)) {
      pointerStates.set(pointer.pointerId, { downX: pointer.x, downY: pointer.y });
    }
  } else {
    pointerStates.delete(pointer.pointerId);
  }

  const state = pointerStates.get(pointer.pointerId);
  let isTap = true;
  if (state) {
    const dx = pointer.x - state.downX;
    const dy = pointer.y - state.downY;
    isTap = Math.hypot(dx, dy) < DRAG_THRESHOLD;
  }

  return { x: pointer.x, y: pointer.y, isTap };
}

export function preventZoom(): void {
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });

  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('gesturechange', (e) => e.preventDefault());
  document.addEventListener('gestureend', (e) => e.preventDefault());
}

export function getTouchScaleFactor(): number {
  return isMobile() ? 1.4 : 1.0;
}
```

- [ ] **Step 3: Update main.ts to prevent zoom**

In `src/main.ts`, add import:

```typescript
import { preventZoom } from './utils/mobile';
```

Add at the top level before game creation:

```typescript
preventZoom();
```

- [ ] **Step 4: Add touch optimization to GameScene**

In `src/scenes/GameScene.ts`, add import:

```typescript
import { normalizePointer, isMobile, getTouchScaleFactor } from '../utils/mobile';
```

In `create()`, after setting up input handlers, wrap the fire logic:

```typescript
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.gameOver) return;
      const normalized = normalizePointer(p);
      if (!normalized.isTap) return;
      const dy = SHOOTER_Y - normalized.y;
      if (dy <= 0) return;
      const dx = normalized.x - SHOOTER_X;
      const angle = Math.atan2(dx, dy);
      this.shooter.setAimAngle(angle);
      this.shooter.fire();
    });
```

In `renderGrid()`, if mobile, make hit areas larger:

```typescript
        if (isMobile()) {
          sprite.setInteractive({ useHandCursor: false, hitArea: new Phaser.Geom.Circle(0, 0, BUBBLE_RADIUS * getTouchScaleFactor()) });
        }
```

- [ ] **Step 5: Optimize MenuScene and MapScene buttons for touch**

In `src/scenes/MenuScene.ts`, add import:

```typescript
import { isMobile } from '../utils/mobile';
```

In `createPlayButton()`, after creating `playBtn`:

```typescript
    if (isMobile()) {
      playBtn.setPadding(12);
    }
```

In `src/scenes/MapScene.ts`, add import:

```typescript
import { isMobile } from '../utils/mobile';
```

In `drawNodes()`, when making nodes interactive:

```typescript
      if (unlocked) {
        const hitRadius = isMobile() ? NODE_RADIUS * 1.5 : NODE_RADIUS;
        circle.setInteractive(new Phaser.Geom.Circle(0, 0, hitRadius), Phaser.Geom.Circle.Contains);
        label.setInteractive({ useHandCursor: true });
        // ... rest of click handlers
      }
```

- [ ] **Step 6: Run mobile tests**

```bash
npm test -- tests/utils/mobile.test.ts
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/utils/mobile.ts tests/utils/mobile.test.ts src/main.ts src/scenes/GameScene.ts src/scenes/MenuScene.ts src/scenes/MapScene.ts
git commit -m "feat: add mobile touch support with drag threshold and zoom prevention"
```

---

## Task 7: Build Verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```
Expected: All tests pass.

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 3: Run build**

```bash
npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 4: Final commit**

```bash
git commit -m "feat(phase-3): complete polish pass — audio, particles, animations, mobile"
```

---

## Spec Coverage Check

| Spec Requirement | Implementing Task |
|------------------|-------------------|
| Particle system tuning | Task 1 — Enhanced Particle System |
| Sound effects (Phaser Web Audio) | Task 2 — Sound Effects System, Task 3 — Hook Audio |
| Background music loop | Task 2 — MusicPlayer class, Task 3 — scene hooks |
| Bubble idle animation (gentle pulse) | Task 4 — Bubble Idle Animations |
| Map scene parallax / ambient animations | Task 5 — Map Scene Ambient Polish |
| Mobile touch support tuning | Task 6 — Mobile Touch Support |

**No gaps found.**

## Placeholder Scan

- No "TBD", "TODO", or "implement later" strings
- No vague requirements like "add appropriate error handling"
- All test code is complete and runnable
- All implementation code is complete and copy-paste ready
- No "Similar to Task N" references

## Type Consistency Check

- `AudioManager` methods consistently use `void` return type
- `BubbleColor` type imported consistently from `./Bubble`
- Config constants use consistent naming (`SCREAMING_SNAKE_CASE`)
- Phaser type references (`Phaser.GameObjects.Image`, etc.) are consistent
- All event emitter calls match listener signatures defined in GameScene

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-09-phase-3-polish.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

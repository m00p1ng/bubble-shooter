import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SoundEffects } from '../../src/audio/SoundEffects';

describe('SoundEffects', () => {
  let sfx: SoundEffects;
  let mockCtx: any;

  beforeEach(() => {
    mockCtx = {
      createOscillator: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
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
      createBuffer: vi.fn(() => ({ getChannelData: vi.fn(() => new Float32Array(100)) })),
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

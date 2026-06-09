import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/audio/SoundEffects', () => ({
  SoundEffects: vi.fn().mockImplementation(() => ({
    playPop: vi.fn(),
    playShoot: vi.fn(),
    playBounce: vi.fn(),
    playWin: vi.fn(),
    playLose: vi.fn(),
    playOrphanDrop: vi.fn(),
  })),
}));

vi.mock('../../src/audio/MusicPlayer', () => ({
  MusicPlayer: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    resume: vi.fn(),
    setVolume: vi.fn(),
  })),
}));

vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => ({
  state: 'running',
  resume: vi.fn(),
  createOscillator: vi.fn(),
  createGain: vi.fn(),
  destination: {},
  currentTime: 0,
  sampleRate: 44100,
})));

import { AudioManager } from '../../src/audio/AudioManager';

describe('AudioManager', () => {
  let mockScene: any;

  beforeEach(() => {
    mockScene = {
      sound: { mute: false },
    };
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

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    BlendModes: { ADD: 1 },
  },
}));

import { Effects } from '../../src/game/Effects';

describe('Effects', () => {
  let mockScene: any;
  let effects: Effects;

  beforeEach(() => {
    const mockEmitter = {
      explode: vi.fn(),
      setParticleTint: vi.fn(),
    };
    mockScene = {
      add: {
        particles: vi.fn(() => mockEmitter),
      },
      cameras: {
        main: { shake: vi.fn() },
      },
      tweens: { add: vi.fn() },
    };
    effects = new Effects(mockScene);
  });

  it('should create particle emitter on construction', () => {
    expect(mockScene.add.particles).toHaveBeenCalledWith(0, 0, 'particle', expect.any(Object));
  });

  it('should emit particles on popBurst', () => {
    effects.popBurst(100, 200, 'RED');
    const emitter = mockScene.add.particles();
    expect(emitter.setParticleTint).toHaveBeenCalledWith(0xff4081);
    expect(emitter.explode).toHaveBeenCalledWith(16, 100, 200);
  });

  it('should shake camera with intensity based on match count', () => {
    effects.shakeCamera(5);
    expect(mockScene.cameras.main.shake).toHaveBeenCalledWith(150, 0.025);
  });
});

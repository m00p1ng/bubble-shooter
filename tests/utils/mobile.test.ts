import { describe, it, expect, vi, afterEach } from 'vitest';
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
    it('should return pointer position for pointer with no drag', () => {
      const ptr = { pointerId: 1, x: 100, y: 200, downX: 100, downY: 200, isDown: true } as Phaser.Input.Pointer;
      const result = normalizePointer(ptr);
      expect(result).toEqual({ x: 100, y: 200, isTap: true });
    });

    it('should detect drag when distance exceeds threshold', () => {
      const ptr = {
        pointerId: 2,
        x: 100,
        y: 200,
        downX: 100,
        downY: 200,
        isDown: true,
      } as Phaser.Input.Pointer;
      normalizePointer(ptr);

      ptr.x = 120;
      ptr.y = 220;
      const result = normalizePointer(ptr);
      expect(result.isTap).toBe(false);
    });

    it('should treat consecutive presses with the same pointer as separate taps', () => {
      const ptr = {
        pointerId: 3,
        x: 100,
        y: 200,
        downX: 100,
        downY: 200,
        isDown: true,
      } as Phaser.Input.Pointer;
      expect(normalizePointer(ptr).isTap).toBe(true);

      ptr.x = 300;
      ptr.y = 150;
      ptr.downX = 300;
      ptr.downY = 150;

      expect(normalizePointer(ptr).isTap).toBe(true);
    });
  });

  describe('preventZoom', () => {
    it('should add event listeners without throwing', () => {
      if (typeof document === 'undefined') return;
      const addSpy = vi.spyOn(document, 'addEventListener');
      expect(() => preventZoom()).not.toThrow();
      expect(addSpy).toHaveBeenCalled();
      addSpy.mockRestore();
    });
  });
});

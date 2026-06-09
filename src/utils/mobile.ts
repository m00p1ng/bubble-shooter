const DRAG_THRESHOLD = 10;

export function isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function normalizePointer(pointer: Phaser.Input.Pointer): { x: number; y: number; isTap: boolean } {
  const dx = pointer.x - pointer.downX;
  const dy = pointer.y - pointer.downY;
  const isTap = Math.hypot(dx, dy) < DRAG_THRESHOLD;

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

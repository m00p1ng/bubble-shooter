export function fadeOutAndStart(
  scene: Phaser.Scene,
  targetScene: string,
  options?: {
    data?: Record<string, unknown>;
    stopScenes?: string[];
  },
): void {
  const { data, stopScenes } = options ?? {};
  const w = scene.scale.width;
  const h = scene.scale.height;

  const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0);
  overlay.setDepth(1000);

  scene.tweens.add({
    targets: overlay,
    alpha: 1,
    duration: 250,
    onComplete: () => {
      stopScenes?.forEach((key) => scene.scene.stop(key));
      scene.scene.start(targetScene, data);
    },
  });
}

export function fadeIn(scene: Phaser.Scene): Phaser.GameObjects.Rectangle {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 1);
  overlay.setDepth(1000);

  scene.tweens.add({
    targets: overlay,
    alpha: 0,
    duration: 250,
    onComplete: () => overlay.destroy(),
  });

  return overlay;
}

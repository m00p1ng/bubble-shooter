import Phaser from 'phaser';

export function createStarfield(
  scene: Phaser.Scene,
  count = 80,
  depth = -5,
  maxOffset = 14,
): Phaser.GameObjects.Container[] {
  const layerRatios = [0.44, 0.34, 0.22];
  const movementRatios = [0.36, 0.64, 1];
  const layers = layerRatios.map((_, index) => {
    const layer = scene.add.container(0, 0);
    layer.setDepth(depth - (layerRatios.length - 1 - index));
    return layer;
  });

  let created = 0;
  layerRatios.forEach((ratio, layerIndex) => {
    const layerCount = layerIndex === layerRatios.length - 1
      ? count - created
      : Math.round(count * ratio);
    created += layerCount;

    for (let i = 0; i < layerCount; i++) {
      layers[layerIndex].add(
        scene.add.circle(
          Phaser.Math.Between(0, scene.scale.width),
          Phaser.Math.Between(0, scene.scale.height),
          Phaser.Math.FloatBetween(0.5 + layerIndex * 0.25, 1 + layerIndex * 0.35),
          0xffffff,
          Phaser.Math.FloatBetween(0.2 + layerIndex * 0.1, 0.4 + layerIndex * 0.15),
        ),
      );
    }
  });

  scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
    const centerX = scene.scale.width / 2;
    const centerY = scene.scale.height / 2;
    const normalizedX = (pointer.x - centerX) / centerX;
    const normalizedY = (pointer.y - centerY) / centerY;
    layers.forEach((layer, index) => {
      layer.x = normalizedX * maxOffset * movementRatios[index];
      layer.y = normalizedY * maxOffset * movementRatios[index];
    });
  });

  return layers;
}

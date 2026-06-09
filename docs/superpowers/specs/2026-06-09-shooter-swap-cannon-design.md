# Shooter Swap and Cannon Wrapper Design

## Goal

Allow the player to click the next bubble to swap it with the active bubble, and visually frame the active bubble inside a neon energy-cradle cannon.

## Interaction

- The next bubble is interactive and uses a hand cursor.
- Clicking it swaps the complete active and next bubble values, including both color and special-bubble type.
- The player may swap an unlimited number of times before firing.
- Swapping is ignored while the shooter is in its post-fire cooldown.
- Firing continues to promote the next bubble and generate a new queued bubble as it does today.

## Shooter Ownership

`Shooter` owns the swap operation because it already owns the current and next queue state and both sprites.

Add a `swapBubbles()` method that:

1. Returns without changing state during cooldown.
2. Exchanges the `current` and `next` `QueuedBubble` objects.
3. Refreshes both sprite textures.

The next sprite's pointer handler calls this method directly. `GameScene` does not need a new swap event or queue knowledge.

## Cannon Wrapper

Use the selected Energy Cradle treatment:

- A circular neon cyan ring surrounds the active bubble.
- The top of the ring remains open so the firing direction reads clearly.
- A short purple base anchors the cradle below the bubble.
- The active bubble remains visually dominant and centered at the existing launch origin.

`BootScene` generates the cradle as a procedural canvas texture. `Shooter` creates a cradle image behind the active bubble and destroys it with the other shooter-owned objects.

## Testing

Add focused Shooter tests with a minimal Phaser scene fixture:

- Swapping exchanges complete `{ color, type }` values.
- Swapping refreshes active and next sprite textures.
- Repeated swaps are allowed before firing.
- Swapping during cooldown does nothing.

Run the complete Vitest suite and production build after implementation.

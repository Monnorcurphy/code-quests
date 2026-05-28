# BUG: playDefeat leaves orphan MonsterSprite, HpBar, and labels on the scene
**Severity:** CRITICAL
**File(s):** packages/client/src/game/entities/monster-sprite.ts, packages/client/src/game/combat-layer.ts

## Problem
`MonsterSprite.playDefeat` plays a camera shake and a delayed `onComplete` callback, but it never calls `_destroyAll()` — so the underlying `Phaser.GameObjects.Image`, `nameLabel`, `difficultyBanner`, and `HpBar` graphics remain in the scene after the encounter resolves.

```ts
playDefeat(onComplete: () => void): void {
  if (this.reducedMotion) {
    onComplete();          // ← no _destroyAll()
    return;
  }
  this.scene.cameras.main.shake(DEFEAT_SHAKE_MS, 0.02);
  this.scene.time.delayedCall(DEFEAT_COMPLETE_MS, onComplete); // ← no _destroyAll()
}
```

Compare with `playVictory` and `playEscape`, both of which call `_destroyAll()` from inside the tween's `onComplete`.

The combat-layer `onComplete` callback then runs:
```ts
const onComplete = () => {
  this._sprite = null;                                       // reference is dropped here
  this._active = false;
  this._animPlaying = false;
  useEncounterStore.getState().clearQuest(questId);          // triggers _onEncounterChange(null)
};
```

By the time `_onEncounterChange(null)` fires from the `clearQuest` store update, `this._sprite` is already `null`, so the `if (this._sprite) { this._sprite.destroy(); ... }` branch is skipped. The Phaser game objects are orphaned in the scene until the scene shuts down.

User-visible impact: after the player loses a fight, the monster sprite, name label, difficulty stars, and full HP bar stay visible at the encounter position for the rest of the scene. The player can walk through/past them. They only disappear on scene transition.

## Expected
After every resolution outcome (`victory`, `defeat`, `escape`, including the `reducedMotion` branches), the monster sprite, name label, difficulty banner, and HP bar must be destroyed and removed from the Phaser scene. Per the spec acceptance criterion: "on `monster_defeated` / `monster_fled`, the sprite plays its outcome animation and exits."

## Fix
1. In `packages/client/src/game/entities/monster-sprite.ts`, make `playDefeat` destroy its children in both branches:
   - Reduced-motion branch: call `this._destroyAll()` before `onComplete()`.
   - Animation branch: change the `delayedCall` callback to `() => { this._destroyAll(); onComplete(); }`.
2. Add a regression test in `packages/client/src/__tests__/combat-layer.test.ts` that asserts `mockSpriteInstance.destroy` (or a new `_destroyAll` spy) is called when the resolution is `defeat`. The current `'calls playDefeat on defeat'` test only verifies that `playDefeat` is invoked, not that the sprite is torn down.
3. Optionally harden `CombatLayer._playOutcome` so that the layer's `onComplete` always calls `sprite.destroy()` defensively, so a future regression in any specific outcome method does not leak game objects.

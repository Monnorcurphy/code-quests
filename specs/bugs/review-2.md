# BUG: Player can move and re-trigger animation during scene freeze

**Severity:** HIGH
**File(s):** `packages/client/src/game/scenes/base-quest-scene.ts`, `packages/client/src/game/entities/player.ts`

## Problem

The extratropical-cyclone spec (step 3) requires:

> Sprite frame doesn't change while frozen — the user reads the prompt against a held image.

And step 3 also says the freeze must "stop physics updates if any" and freeze the scene's animations.

The current freeze implementation pauses `tweens` and calls `player.pauseAnimations()`, but `BaseQuestScene.update()` (`base-quest-scene.ts:160-171`) continues to run `this.controller.update()` every tick during the freeze. The `KeyboardController` is wired to `move-left` / `move-right` / `stop` callbacks (`base-quest-scene.ts:84-87`) that invoke `Player.moveLeft()` / `Player.moveRight()`. These methods:

1. **Mutate sprite position** via `this.setX(newX)` — the player visibly slides across the frozen scene.
2. **Call `_playAnim('player-walk')`** which, when the player transitions from idle to moving, calls `this.sprite.play('player-walk', true)`. In Phaser 3, calling `play()` on a paused animation **restarts** it, undoing the prior `anims.pause()`. So holding an arrow key during a freeze unpauses the walk animation.

Net effect: pressing arrow keys during `paused_input` or `user_blocked` breaks both the visual position freeze and the sprite-frame freeze. The freeze is leaky — the user can still drive the adventurer around while the agent is paused, contradicting the spec's "held image" requirement and creating a confusing UX (player can walk past monsters, advance scenes, etc. while the agent is supposed to be blocked).

Also: the `_edgeTriggered` / `nextSceneKey` check in `update()` is still evaluated during freeze, so a player who walks far enough during the freeze can trigger an unintended scene advance.

## Expected

While `_frozen === true`:
- Keyboard controller input must not advance the player position.
- Animations must remain paused (no re-trigger via `play()`).
- Scene-edge advance logic must not fire.

The spec is unambiguous: the user reads the prompt against a "held image".

## Fix

Gate the update loop on `_frozen`. In `base-quest-scene.ts:160`, short-circuit when frozen so neither controller input nor edge detection runs:

```typescript
update(_time: number, delta: number): void {
  this._delta = delta;
  if (this._frozen) return;
  this.controller.update();

  const next = this.nextSceneKey;
  if (!this._edgeTriggered && !this._combatLayer?.encounterActive && next !== null) {
    if (this.player.getX() >= this.sceneWidth - EDGE_THRESHOLD) {
      this._edgeTriggered = true;
      sceneRouter.requestSceneAdvance({ fromScene: this.sceneKey, toScene: next });
    }
  }
}
```

Promote `_frozen` to `protected` (or expose a `get frozen(): boolean` accessor) so subclasses can also short-circuit if they add their own update logic.

Add a vitest case in `quest-scenes.test.ts` under the freeze describe block:

```typescript
it('does not move player when controller fires during freeze', () => {
  scene.create();
  useQuestStore.getState().setStatus('q1', 'paused_input');
  const beforeX = scene.player.getX();
  scene.update(0, 16);
  // simulate move-left callback being invoked
  // assert player position unchanged AND sprite.play not re-called
  expect(scene.player.getX()).toBe(beforeX);
});
```

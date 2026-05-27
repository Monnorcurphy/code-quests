# BUG: scene-keyboard-nav does not mirror in-scene interactives and uses a different handler than the in-canvas Enter

**Severity:** HIGH
**File(s):** `packages/client/src/routes/town.tsx`, `packages/client/src/components/scene-keyboard-nav.tsx`

## Problem

The task spec defines `scene-keyboard-nav.tsx` as:

> **accessibility mirror**: hidden-but-tabbable HTML nav region listing every interactive in the current scene (e.g., "Door to War Room", "Quest Board", "Recruit banner"); pressing Enter on one fires the same handler as in-scene interact

And the acceptance criterion:

> `scene-keyboard-nav` lists every interactive currently in the scene; screen readers can navigate it; Enter triggers the same handler as in-canvas Enter

The implementation in `routes/town.tsx` (lines 152-157) passes a hard-coded list of all 8 buildings as warp items:

```ts
const navItems: SceneNavItem[] = BUILDINGS.map((b) => ({
  id: b.id,
  label: `Go to ${b.name}`,
  onActivate: () => navigate(`/town/${b.id}`),
}));
```

This violates the spec in two ways:

1. **Wrong contents.** The list is a static "go to any building" warp menu, identical for every scene. The spec requires the list to mirror the *interactives currently in this scene* (the door(s) the player can actually walk through, the in-scene panels like Quest Board / Recruit banner, etc.). A screen-reader user gets a misleading model of what is reachable.

2. **Different handler from in-canvas Enter.** The in-canvas Enter path is `KeyboardController interact → BaseTownScene._handleInteract → Door.tryEnter → sceneRouter.emitDoorEnter({ sceneKey, spawnX }) → PhaserTown listener → navigate(url, { state: { spawnX } })`. It passes the door's `targetSpawnX` so the player arrives at the correct entry point. The HTML nav path calls `navigate("/town/<id>")` with no state, so `locationState?.spawnX` is `undefined` and the receiving scene falls back to its `defaultSpawnX`. Same destination, different spawn point. The two paths are not "the same handler".

The component itself (`scene-keyboard-nav.tsx`) is a generic list renderer — the bug is in how `town.tsx` populates it. There is also no mechanism in `BaseTownScene` to expose its current interactives (doors + non-door interactives) to React so the mirror can reflect them.

## Expected

- The nav region must reflect the interactives actually present in the active scene. For task deer scope, that means at minimum: one nav item per `Door` registered in the current `BaseTownScene` (label from `door.label`, e.g., "Door to War Room"), not a static list of all 8 scenes.
- Activating a nav item must use the same code path as the in-canvas Enter for that interactive — i.e., it should call `door.tryEnter()` (or equivalently `sceneRouter.emitDoorEnter({ sceneKey, spawnX })` with the door's `targetSpawnX`), so the player arrives at the same spawn coordinate.

## Fix

1. Expose the current scene's interactives to React. Options:
   - Add a `sceneRouter` method `setInteractives(items: SceneNavItem[])` / `onInteractivesChange(cb)` and have `BaseTownScene.create()` publish its doors after constructing them.
   - Or store the active scene's interactives in `useTownStore` (a `setInteractives` action) and read with a selector in `PhaserTown`.

2. In `BaseTownScene`, after instantiating doors, publish a `SceneNavItem[]` derived from `this.doors`, where each item's `onActivate` calls `door.tryEnter()` (so it goes through `sceneRouter.emitDoorEnter` and includes `spawnX`).

3. In `PhaserTown`, replace the static `BUILDINGS.map(...)` with the published list from the active scene (fallback to `[]` while no scene is active or for `'boot'`).

4. Add a test that asserts: when a scene with two doors is active, the nav region renders exactly those two doors' labels, and clicking one fires the same code path (mocked `sceneRouter.emitDoorEnter`) as the in-canvas Enter.

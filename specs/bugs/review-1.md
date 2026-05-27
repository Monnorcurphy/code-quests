# BUG: PhaserTown URL routing integration is untested

**Severity:** HIGH
**File(s):** `packages/client/src/routes/town.tsx`, `packages/client/src/__tests__/town.test.tsx`

## Problem

The acceptance criteria for task deer include three explicit URL/router behaviors:

1. "URL updates to `/town/<scene-key>` on every transition"
2. "Refresh restores the same scene with the player at that scene's default spawn (not last position — refresh resets per-scene position)"
3. "Back/forward browser buttons navigate scenes"

The `PhaserTown` component in `routes/town.tsx` is where this logic lives:
- door-enter listener → `navigate(`/town/${sceneKey}`, { state: { spawnX } })`
- URL change effect → `sceneRouter.goToScene(validSceneKey, { spawnX: locationState?.spawnX })`
- `hasMounted` ref pattern to skip the very first effect run (because initial scene comes from `initialScene` on mount, not from `goToScene`)
- `validSceneKey` fallback to `'boot'` for unknown sceneKeys

None of this is covered by tests. `vitest.config.ts` defines `VITE_PHASER_TOWN = 'false'` so unit tests render `HtmlTown` and never exercise `PhaserTown`. The only existing tests touching this area cover `SceneRouter`, `Door`, and `SceneKeyboardNav` in isolation — they do not exercise the React↔Phaser bridge that the URL contract depends on.

The task spec explicitly says: "Tests cover the router, the door interaction, and the keyboard nav mirror" — and the acceptance criteria above are tied directly to the URL routing wired up in `PhaserTown`. Without tests for it, regressions on deep-linking, refresh-spawn behavior, the `hasMounted` skip, or the `validSceneKey` fallback will not be caught.

## Expected

Per `.claude/rules/testing.md` and the task acceptance criteria, the `PhaserTown` URL integration needs test coverage. At minimum:

1. A test where the doorEnter handler is invoked and the URL/history state is asserted to be `/town/<sceneKey>` with `state.spawnX` set.
2. A test that on initial mount with `/town/war-room`, `PhaserMount`'s `initialScene` is `'war-room'`.
3. A test that an URL change from `/town/town-square` → `/town/war-room` triggers `sceneRouter.goToScene('war-room', { spawnX })` (and does NOT call it on the initial render).
4. A test that an unknown sceneKey in the URL falls back to `'boot'`.

These can be written with `MemoryRouter` (with `initialEntries`) plus a mock for `sceneRouter` and a stubbed `PhaserMount` to avoid pulling in real Phaser.

## Fix

Add tests in `packages/client/src/__tests__/` (or alongside `town.test.tsx`) that:

1. Set `VITE_PHASER_TOWN` for these tests or import `PhaserTown` directly, so the Phaser branch executes.
2. Mock `../game/scene-router` and `../game/phaser-mount` to assert calls.
3. Render `<MemoryRouter initialEntries={['/town/war-room']}>` and assert:
   - `PhaserMount` is rendered with `initialScene="war-room"`.
   - `sceneRouter.goToScene` is NOT called on the first effect (due to `hasMounted`).
4. Trigger the `onDoorEnter` callback registered on `sceneRouter` and assert that the history advances to `/town/<targetSceneKey>` with `state.spawnX` set.
5. Navigate the router to a new URL and assert `goToScene` is called with the new key (and `spawnX: undefined` when no state is present, simulating a refresh).
6. Add a test for the `'boot'` fallback when `rawSceneKey` is missing or unknown.

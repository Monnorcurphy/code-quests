# Review Pass — task deer

## Checks performed
- Read full task spec (`metrics/task-deer-context.md`) and acceptance criteria.
- Read the pre-computed diff and all changed/added files:
  - `app.tsx`, `routes/town.tsx`
  - `components/scene-keyboard-nav.tsx` + tests
  - `game/scene-router.ts` + tests
  - `game/entities/door.ts` + tests
  - `game/scenes/base-town-scene.ts`
  - `game/scene-registry.ts`, `game/phaser-mount.tsx`
- Ran `pnpm --filter @code-quests/client test` → 13 files, 111 tests pass.
- Ran `pnpm --filter @code-quests/client typecheck` → clean.
- Ran `pnpm --filter @code-quests/client lint` → clean.
- grep for `console.*` in `packages/client/src` → none.
- grep for Tailwind contrast violations (`text-{gray,neutral,slate,zinc}-{100..400}`) → none.
- grep for secrets patterns (`sk-`, `AKIA`, `api_key`, `password=`) → none found in diff.
- Cross-boundary: SceneKey union (frontend) vs `TOWN_SCENE_KEYS` (frontend) — consistent; no DB/HTTP boundary in this task.
- Verified accessibility: nav landmark with aria-label, visually-hidden via clip/overflow, real `<button>` elements, focus stays operable via Tab.
- Verified reduced-motion: scene-router fade gated on `prefers-reduced-motion`, base-town-scene fade-in gated identically.

## Bugs filed
- `specs/bugs/review-1.md` — HIGH — PhaserTown URL routing integration is untested (vitest forces `VITE_PHASER_TOWN='false'`, so PhaserTown is never rendered in unit tests; acceptance criteria for URL sync / refresh-to-spawn / back-forward are unverified).
- `specs/bugs/review-2.md` — HIGH — scene-keyboard-nav populated with a static "Go to {name}" warp list for all 8 scenes instead of mirroring the current scene's interactives; HTML nav Enter calls `navigate()` without `state.spawnX` while in-canvas Enter passes the door's `targetSpawnX` (different handlers).
- `specs/bugs/review-3.md` — LOW — `isTownSceneKey` returns `key is SceneKey` but only validates the town subset; type predicate should narrow to `TownSceneKey`.

## Informational notes (no bug filed)

- **`FADE_DURATION_MS = 300` duplicated** in `scene-router.ts` and `base-town-scene.ts`. Per `code-quality.md` rule-of-three, two occurrences is still acceptable inline, but a third use should be extracted to a shared constant (e.g., `game/constants.ts`).
- **Door height / door Y / scene width constants** are duplicated between `Door` defaults and `BaseTownScene` layout (96, 64, ground geometry). Same rule-of-three threshold; consider consolidating when a third scene adds doors.
- **Town-edge exits** mentioned in the spec ("door or town-edge exit") are not implemented. They can be modeled as `Door` instances at the scene edges, so no new entity is required; consider when authoring concrete town scenes (task elephant/fox).
- **`scene-router.goToScene` skips when target key matches the current scene.** If a future feature ever uses two doors that both target the *same* scene with *different* spawn points (e.g., enter Town Square from east vs west), the early-return will prevent the player from being re-placed. Not a problem today because the URL-driven flow only fires `goToScene` when `validSceneKey` changes, but worth remembering.
- **`scene-router.getScenes(true)[0]`** assumes the first active scene is the "current" one. Only `BootScene` is active at game boot, and town scene transitions stop+start, so this holds for now. If parallel scenes (HUD overlay, modal scene) are added later, this assumption needs revisiting.
- **`location.state` is read as `{ spawnX?: number } | null` via an unchecked cast.** This is internal app state (not a serialized cross-system boundary), so runtime validation is not strictly required by the rules, but a small `z.object` guard would prevent surprises if state ever arrived from a non-trusted source.

## Verdict
FAIL — 3 bugs filed (2 HIGH, 1 LOW).

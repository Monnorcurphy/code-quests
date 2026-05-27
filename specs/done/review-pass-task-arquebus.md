# Review Pass — TASK arquebus

**Task:** BaseQuestScene + 4 quest scene classes
**Branch:** feature/arquebus (parent: feature/arbalest)
**Verdict:** PASS (0 bugs filed)

## Checks Performed

- Read pre-computed diff (12 files, +623/-13 LOC).
- Read full task spec at `metrics/task-arquebus-context.md`.
- Read all new/modified source files:
  - `packages/client/src/game/scenes/base-quest-scene.ts` (88 lines)
  - `packages/client/src/game/scenes/quest-forest-scene.ts` (29 lines)
  - `packages/client/src/game/scenes/quest-cave-scene.ts` (29 lines)
  - `packages/client/src/game/scenes/quest-dungeon-scene.ts` (29 lines)
  - `packages/client/src/game/scenes/quest-boss-room-scene.ts` (29 lines)
  - `packages/client/src/game/scene-registry.ts`
  - `packages/client/src/game/scene-router.ts`
  - `packages/client/src/game/game-config.ts`
  - `packages/client/src/game/scenes/__tests__/quest-scenes.test.ts` (282 lines — test file, exempt)
- Cross-referenced against existing `BaseTownScene` and `TownSquareScene` patterns to confirm parity.
- Confirmed `Player.setX()` clamps via `bounds.max` (set to `sceneWidth=2400` in `create()`) so the test's `setX(2320)` and `setX(2400)` calls are valid.
- Confirmed debounce: `_edgeTriggered` is set on first fire and reset in `init()` (Phaser re-uses scene instances across restarts — `init()` runs each time).
- Confirmed `nextSceneKey` narrowing: after `next !== null` check, `toScene: next` is typed as `QuestSceneKey`.
- Verified `controller.update()` call ordering: `_delta = delta` runs before `controller.update()`, so movement callbacks see the current frame's delta — same pattern as `BaseTownScene`.

## Commands Run

| Command | Result |
|---|---|
| `pnpm typecheck` | Clean (3 packages, 0 errors) |
| `pnpm lint` | Clean (0 errors, 0 warnings) |
| `pnpm --filter=./packages/client test` | 360 tests passing (29 test files) |
| `pnpm --filter=./packages/client build` | Built successfully |
| Secret grep (`sk-`, `AKIA`, `api_key`, `password=`) | No matches in `packages/client/src/game` |
| `console.log/warn/error/info/debug` grep | No matches in `packages/client/src/game` |
| File-size check | base-quest 88 ≤ 250, each scene 29 ≤ 80 |

## Boundary Contract Validation

- `SceneAdvanceEvent { fromScene: QuestSceneKey; toScene: QuestSceneKey }` — both fields constrained to the same `QuestSceneKey` union, which exactly matches the four new entries in `SceneKey`. No drift.
- `QUEST_SCENE_KEYS` array order matches the canonical chain (`forest → cave → dungeon → boss-room`) and each `nextSceneKey` getter returns the next entry — verified by the `nextSceneKey chain` test.
- `QUEST_ASSET_KEYS` (consumed by `backgroundAssetKey` / `groundAssetKey` getters) exist in `asset-loader.ts` — verified by reading the asset loader.
- No DB/SQL boundary touched by this task.

## Capstone Coverage

Not applicable — task arquebus is **not** the capstone of Phase 5 (`greatsword` is, per `specs/phase-05/sequence.md`). The quest scenes are intentionally not wired to the React route yet — that is the explicit responsibility of `cestus` later in the phase. The task spec confirms this: "for now just emit through `sceneRouter`".

## Spec Acceptance Criteria — All Met

- [x] All 4 scenes render without throwing in the headless test harness.
- [x] `SceneKey` union compiles and includes the 4 new quest keys.
- [x] Edge-trigger fires exactly once per arrival (debounce verified by `edge trigger fires exactly once (debounce)` test).
- [x] Each scene file ≤ 80 lines (each is 29 lines), `BaseQuestScene` ≤ 250 lines (88 lines), max nesting 3, no `console.log`.
- [x] Reuses existing `Player` and `KeyboardController` — confirmed via imports.
- [x] `prefers-reduced-motion` disables fade-in (asserted via dedicated test).
- [x] `Boss-room scene does NOT emit advance when right edge reached (terminal scene)` — verified by 2 tests.

## INFORMATIONAL Notes (not bugs)

1. **Test title is slightly misleading**: `it('create() calls preloadQuestAssets and fadeIn', ...)` only asserts `preloadQuestAssets` was called — the actual fade-in assertion lives in the next test. Doesn't affect correctness. Future cleanup: rename to `'preload() calls preloadQuestAssets'`.

2. **Reduced-motion test cleanup is not exception-safe**: The `'create() uses fade duration 0 when prefers-reduced-motion is set'` test sets `window.matchMedia` via `Object.defineProperty` and resets it on the last line. If the `expect` ever fails, the reset never runs and subsequent tests in the file would see a leaked `matches: true` stub. Today this is harmless because no later test in the file checks fade duration without first overriding `matchMedia`, but it would be more robust as an `afterEach` cleanup or `try/finally`.

3. **No interactivity hint in quest scenes (future task concern)**: The base quest scene wires only `move-left` / `move-right` / `stop`. Town scenes additionally wire `interact` and a `shutdown` cleanup via `sceneRouter.setInteractives([])`. Quest scenes intentionally don't yet — the React route (`cestus`) will handle this. Worth verifying in cestus that the React side announces "Walk right to advance" via `aria-live` so blind users know what to do, since the scene itself has no visual prompt.

4. **Phase 5 progress.md update**: progress.md was updated and archived correctly (`metrics/progress-before-arquebus.md` referenced). Matches the convention from Phase 1.

## Final Verdict

**PASS** — 0 bugs filed. Implementation is faithful to the task spec, mirrors the established `BaseTownScene` pattern correctly, has comprehensive tests covering the edge debounce, the terminal-scene guard, reduced-motion handling, and the full `nextSceneKey` chain. All quality gates (typecheck, lint, tests, build) pass.

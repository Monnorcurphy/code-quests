# Review Pass — Task alpaca (Phaser 3 integration + scene manager)

**Branch:** feature/alpaca
**Parent:** feature/caernarfon
**Reviewer model:** adversarial reviewer agent

## Checks Performed

- Read pre-computed diff (14 files, +254/-22).
- Read full source of: `phaser-mount.tsx`, `scene-registry.ts`, `game-config.ts`, `boot-scene.ts`, `town-store.ts`, `town.tsx`, `vite-env.d.ts`, `vitest.config.ts`, `playwright.config.ts`, `package.json`, both new test files, existing `town.test.tsx`, ESLint config.
- Ran `pnpm --filter @code-quests/client typecheck` — clean (no output).
- Ran `pnpm --filter @code-quests/client lint` — clean (no output).
- Ran `pnpm --filter @code-quests/client test` — 7 files, 54 tests pass.
- Ran `pnpm --filter @code-quests/client build` — succeeds; Phaser bundled as a code-split chunk (`phaser-mount-*.js`, ~1.48 MB raw / 340 KB gzip).
- Ran other workspace tests (`@code-quests/server`) — 67 tests pass.
- Grep'd `packages/client/src/` for hardcoded secrets (`AKIA`, `sk-`, `api_key`, `password=`) — none found.
- Verified `VITE_PHASER_TOWN` env-var flow: client default is "Phaser on"; vitest `define` forces "off" for unit tests; Playwright web-server env forces "off" for E2E. Phase 1 capstone E2E remains exercised against `HtmlTown`.
- Checked cross-boundary values: `currentScene: 'boot'` initial state matches the `SceneKey` union and the `'boot'` key the boot scene registers — no mismatch.
- Verified that `PhaserMount` is `React.lazy()`-imported so Phaser is never resolved when the flag is off (jsdom safety).
- Verified `useEffect` teardown calls `destroy(true)` and that the dedicated test loops mount/unmount 5× with no leak.

## Bugs Filed

1. `specs/bugs/review-1.md` — **HIGH** — `initialScene` prop on `PhaserMount` is dead. `_initialScene` is unused in `game-config.ts`, boot scene never calls `this.scene.start(...)`, and the misleading `useEffect([initialScene])` dependency would tear down and recreate the entire Phaser game for no functional reason if the prop ever changed. Spec explicitly requires the prop to drive scene selection.

## Informational Notes (not bugs)

- **Phaser canvas accessibility:** `phaser-mount.tsx` renders the container with `role="application"` + `aria-label="Game canvas"`. `role="application"` instructs screen readers to surrender their virtual cursor — appropriate for an interactive game, but means *all* user input must be handled inside the canvas. This task is plumbing only (no interactions yet), so it isn't actionable now. Later phases that add real interaction must provide keyboard handlers and a screen-reader-friendly status region inside or beside the canvas (see project accessibility rules: "Every interactive element must be operable via keyboard").
- **`useTownStore` is currently unused** anywhere in production code. Per-spec — the task explicitly lists this file. Phase 2's next task is expected to wire it up.
- **`getScene` / `getSceneList` exports** are unused outside tests. Per-spec — the scene registry is intended to be consumed by the React HUD in later tasks.
- **Bundle size warning:** `phaser-mount-*.js` is 1.48 MB raw (~340 KB gzip). Phaser is large by nature and we already code-split it. Not a bug; flag for future optimisation if the gzip target tightens.
- **No E2E coverage for the Phaser path.** The default-on Phaser branch is what real users will see, but every existing E2E test forces `VITE_PHASER_TOWN=false`. This matches the explicit spec ("Phase 1 capstone E2E test still passes under the fallback flag") and is acceptable for a plumbing task, but Phase 2's capstone should add at least one Playwright spec that asserts the Phaser canvas mounts with `VITE_PHASER_TOWN` unset.
- **Scene-registry tests share module state.** `registerScene('boot', …)` accumulates across tests within the file. Each test sets what it needs so order doesn't break anything today, but a `beforeEach`/`afterEach` reset (or exposing a `__clearRegistry` test-only hook) would harden against future test additions.

## Verdict

**FAIL** — 1 HIGH bug filed (`specs/bugs/review-1.md`).

The implementation is otherwise solid: build/test/lint/typecheck all green; the Phase 1 fallback works; the lazy-import + env-var pattern correctly keeps Phaser out of jsdom; teardown is verified by a multi-cycle unit test. The single HIGH issue is the dead `initialScene` prop, which must be either wired up (preferred, matches spec) or removed before merge to prevent silent breakage when Phase 2's later tasks add additional scenes.

# Review Pass — Task giraffe (Phase 2 Capstone)

**Verdict:** FAIL — 2 bugs filed (1 CRITICAL, 1 LOW)

## Checks Performed

- Re-read the task spec (`metrics/task-giraffe-context.md`) and Phase 2 capstone rule.
- Read every new/changed source file listed in the diff stat:
  - `packages/client/src/components/hud-overlay-manager.tsx` (new)
  - `packages/client/src/components/settings-button.tsx` (new)
  - `packages/client/src/components/__tests__/hud-overlay-manager.test.tsx` (new)
  - `packages/client/src/components/__tests__/settings-button.test.tsx` (new)
  - `packages/client/src/routes/town.tsx` (rewritten — Phaser-only)
  - `packages/client/src/app.tsx`, `packages/client/src/main.tsx`
  - `packages/client/src/game/scene-router.ts` (reduced-motion getter)
  - `packages/client/src/__tests__/town.test.tsx`, `packages/client/src/app.test.tsx`
  - `packages/client/src/styles/features.css` (settings panel + button styles)
  - `packages/client/tests/e2e/phase-1-capstone.spec.ts`, `phase-2-capstone.spec.ts`, `all-buildings.spec.ts`
  - `playwright.config.ts`, `README.md`, `progress.md`
- Verified Phase 1 surfaces (TownSquare, WarRoom, GuildHall, ComingSoonPanel) still wire through `useTownStore.setActiveModal(null)` and continue to use `useFocusTrap`.
- Ran the full verify sequence:
  - `pnpm typecheck` → green (3 packages)
  - `pnpm lint` → green
  - `pnpm test` → 206 tests passing (18 files)
  - `pnpm build` → green
  - `pnpm check:assets` → "Asset license check PASSED — 20 assets verified."
- Grepped for `console.*`, `sk-`, `AKIA`, `api_key`, `password=` in `packages/{client,server}/src` — none found.
- Grepped for Tailwind low-contrast classes (`text-{gray,neutral,slate,zinc}-{100,200,300,400}`) — none. Custom CSS uses high-contrast medieval palette tokens.
- Cross-boundary check: there are no new DB enum/value boundaries in this task. Settings `reduced-motion` writes to localStorage as `'true'`/`'false'` strings; readers check `=== 'true'` consistently. Scene-router reads `document.documentElement.dataset.reducedMotion === 'true'` — matches the writer in `settings-button.tsx`.
- Capstone coverage:
  - Recruit, draft, quest board, guild roster all reachable as HUD overlays driven by `town-store.activeModal`.
  - 7 building doors + town-square scene reachable via Phaser doors and the visually-hidden `nav[aria-label="Scene interactions"]` mirror.
  - Settings (`Reduce motion` toggle) reachable from the top-right ⚙ button on every scene.
  - All confirmed by `phase-2-capstone.spec.ts` walkthrough.
- Grepped for stale `VITE_PHASER_TOWN` references after the flag removal — found two stale source/config refs and a broken E2E spec.

## Bugs Filed

- `specs/bugs/review-1.md` — CRITICAL — `packages/client/tests/e2e/town-square.spec.ts` was not migrated to Phaser mode; every test in the file targets the deleted HTML town and will fail under `pnpm test:e2e`.
- `specs/bugs/review-2.md` — LOW — Stale `VITE_PHASER_TOWN` declarations remain in `packages/client/src/vite-env.d.ts` and `packages/client/vitest.config.ts` after the flag was removed everywhere else.

## INFORMATIONAL Notes

- **React `act()` warnings in `town.test.tsx`** — running `pnpm test` emits many `Warning: An update to HUDOverlayManager inside a test was not wrapped in act(...).` lines (also for `TownSquare`). The warnings come from TanStack Query resolving its `Promise.resolve([])` mocks for `adventurers.list` / `quests.list` after the test's synchronous body completes. Tests still pass (206/206), but the noise makes failures harder to triage. Future cleanup: wrap the post-`act(() => setActiveModal(...))` lookups in `await waitFor(...)` or stub the queries with deterministic synchronous data. Not filed as a bug — warnings, not failures.
- **Settings button stacks at the same z-index as the modal backdrop (z-index 100)** — when a HUD overlay (quest-board / draft / guild-hall / coming-soon) is open, the ⚙ button remains visible and clickable above the backdrop (it renders after `HUDOverlayManager` in DOM order). Clicking it opens the settings panel (z-index 200) on top of an already-open dialog. Two dialogs are technically open simultaneously, and a single `Escape` press will trigger both `useFocusTrap` `onEscape` callbacks (each `useFocusTrap` registers its own `document` keydown listener). This is a UX rough edge but not a strict bug — the spec doesn't require the settings button to hide while a modal is open, and the simultaneous-Escape close still leaves the UI in a valid state (`activeModal=null`, settings closed). Worth tightening in a follow-up: either hide the gear when `activeModal !== null`, or stop event propagation in `useFocusTrap` after the topmost trap handles it.
- **`packages/client/tests/e2e/town-square.spec.ts` could simply be deleted** — its scenarios are already covered by `phase-1-capstone.spec.ts` (recruit flow, accessibility, persistence) and `all-buildings.spec.ts` (escape close). Deletion is the lower-risk fix for bug review-1.

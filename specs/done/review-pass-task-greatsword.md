# Review Pass — TASK greatsword (Phase 5 Capstone)

**Verdict:** FAIL — 4 bugs filed (2 CRITICAL, 1 HIGH, 1 LOW)

## Checks performed

- Read task spec (`metrics/task-greatsword-context.md`) and built understanding of capstone requirements.
- Read all changed files: `quest-board.tsx`, `war-room.tsx`, `return-to-town-button.tsx`, `hud-overlay.tsx`, `routes/quest.tsx`, `server/src/index.ts`, `routes/test-emit.ts`, `scripts/seed-dev.ts`, `phase-5-capstone.spec.ts`, `playwright.config.ts`, `README.md`, `quest-board.test.tsx`.
- Ran `pnpm typecheck` — clean.
- Ran `pnpm lint` — clean.
- Ran `pnpm test` — 426/426 pass.
- Ran `pnpm exec playwright test packages/client/tests/e2e/phase-5-capstone.spec.ts` — **6/6 fail**.
- Verified cross-boundary parity: `current_scene` enum in migration 005 (`quest-forest|quest-cave|quest-dungeon|quest-boss-room`) matches `QuestSceneKey` in client and seeded value `quest-cave`. OK.
- Verified asset credits — Phase 5 art fully credited in `assets/CREDITS.md`.
- Verified the test-emit route is gated by `NODE_ENV === 'test'` in `index.ts` (line 26) and that `createTestEmitRouter` throws when called with `NODE_ENV='production'`.
- Verified the Return-to-Town button preserves last visited town scene via `useTownStore` and defaults to `town-square` when the stored scene is `boot` or a `quest-*` scene.
- Verified capstone reachability:
  - `/quest/:questId` reachable via Party Map peek (all routes), Quest Board "Enter Quest" (active quests), War Room "Watch Quest" (active quests).
  - Return-to-town reachable from HUD overlay on any quest route.
  - All Phase 5 features have an interaction path from Town Square. ✓

## Bugs filed

| # | Severity | Title |
|---|----------|-------|
| 1 | CRITICAL | Phase 5 E2E global-setup command silently fails — seed never runs |
| 2 | CRITICAL | Vite dev server does not proxy `/test/*` — capstone E2E cannot reach test-emit route |
| 3 | HIGH | test-emit production-gating test doesn't actually verify the negative case |
| 4 | LOW | E2E walkthrough does not assert HUD reflects the scene_change event |

The two CRITICAL bugs cause all 6 Phase 5 capstone E2E tests to fail. Acceptance criterion #7 (E2E test runs headlessly and passes) is **not met**, which means the phase capstone is not interactable end-to-end per `.claude/rules/phase-capstone.md`.

## INFORMATIONAL notes (not filed as bugs)

- `packages/client/src/features/quest/return-to-town-button.tsx:11` uses `String(townScene)` defensively. Since `townScene: SceneKey` is already a string union, the cast is unnecessary — but it is also harmless and documents intent for the type-narrowing.
- `packages/client/src/features/quests/quest-board.tsx:87` uses inline styles (`display: 'flex', alignItems: 'center', gap: '8px'`) on the `<li>`. The codebase otherwise uses CSS class files; consider promoting this to `.quest-board-item` styles for consistency. Not blocking.
- `packages/server/src/scripts/seed-dev.ts:234` always inserts a fresh agent row for the demo quest on every seed run. The `existingPhase5` branch ends prior live agents first (lines 204-206), so accumulation is bounded to one live + N ended rows — acceptable for dev seed but noted.
- Builder log states "the E2E suite ... requires both dev servers running to execute" — i.e. the E2E suite was never actually run during verification. This is the proximate cause of the 4 filed bugs slipping through. Recommend integrating E2E into the pre-commit verify sequence going forward.

## Verdict

**FAIL — 4 bugs filed.** The unit-test / lint / typecheck pipeline is green, but the capstone's primary acceptance criterion (Playwright E2E passing) is broken by two distinct CRITICAL issues. Phase 5 cannot be considered interactable end-to-end until reviews 1 and 2 are fixed and the E2E suite is re-run green.

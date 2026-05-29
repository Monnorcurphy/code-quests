# Progress — Phase 9

Previous task progress archived to metrics/progress-before-ginkgo.md

## ginkgo — Hall of Returns capstone (Phase 9 capstone)

**Status:** Done

**What was built:**
- `packages/server/src/lib/quest-failure-detector.ts` — `detectAndHandleFailure()` helper: when a quest is in `failed` status, automatically calls `returnQuestToTown()` to transition to `returned_to_town`
- `packages/server/src/lib/__tests__/quest-failure-detector.test.ts` — 5 unit/integration tests including the "non-zero exit" simulation the spec requires
- `packages/server/src/services/quest-runner.ts` — hooked `detectAndHandleFailure` into both the `failed` event path and the catch-block error recovery path
- `packages/server/src/scripts/seed-dev-phase9.ts` — dev-only seed creating one returned quest (Hydra × 2, `repost_with_clarification`) and one scarred adventurer ("Vance the Scarred")
- `packages/server/package.json` — added `seed:phase9` script
- `packages/client/src/features/guild/scar-list.tsx` — new component: "Scars (N)" badge that expands to show `ScarRecord` entries; each entry deep-links to the originating post-mortem via `navigate()`
- `packages/client/src/features/guild/roster.tsx` — added `<ScarList>` per roster row
- `packages/client/src/features/town-square.tsx` — updated `ReturnedQuestsBadge` to query `api.hallOfReturns.listQuests({ status: 'returned_to_town' })` (correct endpoint) and subscribe to active quests' WebSocket channels for `quest_returned` events to invalidate in real time
- `packages/client/tests/e2e/phase-9-capstone.spec.ts` — Playwright E2E test covering: list view a11y, post-mortem rendering, feedback form, re-post/retire/split dialogs, Guild Hall scar badge
- `assets/CREDITS.md` — Phase 9 note (no new third-party assets)
- `README.md` — Phase 9 walkthrough section + updated phase roadmap table

**Fixes:**
- `packages/server/src/__tests__/quest-runner.test.ts` — updated test assertion for error recovery path: Phase 9 failure detector means quests now end in `returned_to_town` rather than `failed` after an unhandled error

**Tests:** 476 server + 918 client + 83 shared = 1477 total, all green. Lint clean, typecheck clean.

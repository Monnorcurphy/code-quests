# Progress — Phase 11

Previous task progress archived to metrics/progress-before-aquarius.md

## Task aquarius — Showcase seed scenario + reset

**Status:** Complete

**Files created/modified:**
- `packages/server/src/scripts/seed-showcase.ts` — idempotent seed inserting epic-showcase-auth, 3 quests, 3 adventurers, 2 monsters, and skill hit-count/status updates
- `packages/server/src/scripts/reset-showcase.ts` — clears showcase rows and re-seeds; guarded by CODE_QUESTS_ENV=demo
- `packages/server/src/routes/showcase.ts` — POST /showcase/reset endpoint; 403 outside demo env
- `packages/server/src/__tests__/seed-showcase.test.ts` — 23 tests: idempotency, FK integrity, equipment cross-boundary, SpecAudit blocking-gap check, adventurer stats
- `packages/server/src/index.ts` — registered /showcase route
- `packages/server/package.json` — added seed:showcase and reset:showcase scripts

**Verify:** 538/538 tests pass, typecheck clean, lint clean

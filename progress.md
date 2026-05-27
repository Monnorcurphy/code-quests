# Progress — Phase 4

Previous task progress archived to metrics/progress-before-edinburgh.md

## Task edinburgh — Dispatch wiring + quest lifecycle endpoints

**Status:** DONE

**What was built:**
- `packages/shared/src/quest.ts` — Added `FailureSummarySchema` with `recommendation` enum (`retry`, `repost_with_clarification`, `retire`) and `failureSummary` field on `QuestSchema`
- `packages/server/src/services/quest-status.ts` — New. `transitionQuestStatus(db, questId, from, to)` with `InvalidTransitionError` for guarded status changes
- `packages/server/src/services/quest-runner.ts` — New. `runQuest(quest, adventurer, deps)` spawns agent via `getQuestAdapter().spawn()`, creates agents row, fans events to WS channel, transitions quest on `completed`/`failed` events. Returns `{ agent, done }` — background loop runs detached from request handler
- `packages/server/src/routes/quests.ts` — Extended dispatch to call `runQuest()` after status transition; added `POST /:id/complete`, `POST /:id/fail`, `POST /:id/cancel`, `GET /active`
- `packages/server/src/index.ts` — Passes channel getter to `createQuestsRouter` (lazy binding)
- `packages/server/src/__tests__/quest-runner.test.ts` — End-to-end tests with offline adapter
- `packages/server/src/__tests__/quest-lifecycle.test.ts` — Tests for complete/fail/cancel/active endpoints and re-dispatch guard

**Verify results:** 193 tests pass (17 test files), typecheck clean, lint clean.

# Progress — Phase 9

Previous task progress archived to metrics/progress-before-acacia.md

## TASK acacia — Failure summary engine + scar minting (backend)

**Status:** Complete

**What was built:**
- `packages/server/src/db/migrations/007_quest_status_phase9.sql` — expands `quests.status` CHECK to include `returned_to_town` and `retired` via table recreation (SQLite requires this for CHECK constraint changes)
- `packages/shared/src/quest.ts` — expanded `FailureSummaryRecommendationSchema` with `break_into_smaller` and `level_up_first`; expanded `FailureSummarySchema` with optional `fatalEncounterId`, `retries`, `notes`, `userFeedback` fields; added `returned_to_town` and `retired` to `QuestStatusSchema`
- `packages/shared/src/adventurer.ts` — added `ScarRecordSchema` / `ScarRecord` type; updated `AdventurerSchema.scars` from `string[]` to `ScarRecord[]`
- `packages/shared/src/agent.ts` — added `quest_returned` event type to `AgentEventSchema`
- `packages/server/src/lib/failure-summary.ts` — `buildFailureSummary(quest, agents, encounters): FailureSummary` with deterministic recommendation heuristic
- `packages/server/src/lib/scar.ts` — `mintScar(quest, adventurer, failureSummary, ctx): ScarRecord | null` with grace period and spec-fault rules
- `packages/server/src/services/quest-return.ts` — `returnQuestToTown(questId, db, channel?)` orchestrating all writes in a single transaction + WebSocket event emission
- Tests: 3 new test files covering all branches (pure unit + real in-memory SQLite integration)
- Client fixes: Added `returned_to_town`/`retired` to status maps in `quest-board.tsx` and `party-map.tsx`; added `quest_returned` case to event formatters in `active-quest-panel.tsx` and `returned-quest-detail.tsx`

**All 1,320 tests pass; all packages typecheck and lint clean.**

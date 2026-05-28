# Progress — Phase 7

Previous task progress archived to metrics/progress-before-arctic-storm.md

## arctic-storm — Schemas + repository for InputRequest and UserBlocker

**Status:** Complete

**What was done:**
- Added `InputRequestSchema` and `UserBlockerSchema` to `packages/shared/src/quest.ts`
- Extended `QuestSchema` with `inputRequest: InputRequestSchema.nullable().default(null)` and `userBlocker: UserBlockerSchema.nullable().default(null)`
- Added `paused_input` (with `question: string.min(1)`, optional `context`) and `resumed` (with `source: 'input_response' | 'user_unblock'`) variants to `AgentEventSchema` in `packages/shared/src/agent.ts`
- Exported all new types (`InputRequestSchema`, `UserBlockerSchema`, `InputRequest`, `UserBlocker`) from `packages/shared/src/index.ts`
- Created `packages/server/src/db/quest-repository.ts` with `setInputRequest`, `clearInputRequest`, `setUserBlocker`, `getInputRequest`, `getUserBlocker` functions
- Updated `QuestRow` type and `rowToApi` mapper in `packages/server/src/routes/quests.ts` to parse `input_request_json` and `user_blocker_json` columns
- Updated all `Quest` test fixtures across server and client packages to include the new `inputRequest: null` and `userBlocker: null` fields
- Tests: 83 shared + 314 server + 561 client all pass; lint and typecheck clean

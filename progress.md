# Progress — Phase 4

Previous task progress archived to metrics/progress-before-agra-fort.md

## agra-fort — AgentAdapter v2 + agents-table lifecycle service

- Added `AgentSchema` and `AgentEventSchema` (discriminated union) to `packages/shared/src/agent.ts`; re-exported from `index.ts`
- Widened `AgentAdapter` interface to make `complete()` optional and add optional `spawn(input: AgentSpawnInput): Promise<AgentHandle>` with full `AgentSpawnInput` and `AgentHandle` types
- Extended `offlineAdapter` with a `spawn()` implementation that yields a deterministic 4-event sequence (progress → combat → progress → completed) on `setImmediate` cadence; `awaitExit()` resolves with `exitCode: 0` after events drain
- Added `getQuestAdapter()` to `select-adapter.ts` that returns offline adapter by default; returns a throwing stub when `CODE_QUESTS_USE_REAL_AGENT=1` and `claude` binary resolves (real impl deferred to `cartagena`)
- Added `003_agent_indexes.sql` migration with idempotent indexes on `agents(quest_id)` and `agents(adventurer_id)`
- Created `agents-service.ts` with `createAgent`, `endAgent`, `findAgentByQuest`, `findActiveAgents`; all reads parse through `AgentSchema`
- Guarded `adapter.complete?.()` call in `audit-quest.ts` to handle now-optional interface
- 129 tests passing; typecheck and lint clean

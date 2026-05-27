# Progress — Phase 3

Previous task progress archived to metrics/progress-before-beryl.md

## Task beryl — AgentAdapter interface + Haiku spec-audit engine

**Status:** Complete

**What was built:**
- `packages/server/src/agents/adapter.ts` — `AgentAdapter` interface (`name`, `complete()`)
- `packages/server/src/agents/offline-adapter.ts` — deterministic offline implementation (no network)
- `packages/server/src/agents/haiku-adapter.ts` — `createHaikuAdapter()` using `@anthropic-ai/sdk` (claude-haiku-4-5-20251001); throws `MissingApiKeyError` if `ANTHROPIC_API_KEY` absent
- `packages/server/src/agents/select-adapter.ts` — `getAuditAdapter()` returns Haiku if key set, else offline
- `packages/server/src/audit/audit-quest.ts` — `auditQuest(quest, adapter): Promise<SpecAudit>` with deterministic rules first, then LLM gap merging, adapter-error resilient
- `packages/server/src/audit/__tests__/audit-quest.test.ts` — 13 tests covering all deterministic rules, adapter error handling, LLM gap merging, invalid JSON handling

**Deterministic rules:**
1. `description.trim().length < 20` → `war_room/block`
2. No ACs or all < 5 chars → `oracle/block`
3. No edge cases → `tavern/warn`
4. No equipment → `armory/warn`
5. Empty context AND description < 80 chars → `library/warn`

**Verification:** `pnpm test`, `pnpm typecheck`, `pnpm lint` all pass. 87 server tests, 206 client tests.

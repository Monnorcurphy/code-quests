### TASK ashford: Shared types + Zod schemas

**Goal:** Define the runtime-validated types for every entity that crosses the server↔client boundary. Used by both Express handlers (server) and fetch wrappers (client).

**Files to create/modify:**
- `packages/shared/src/index.ts` — re-exports
- `packages/shared/src/quest.ts` — `QuestSchema`, `EpicSchema` (Zod) + `Quest`, `Epic` types via `z.infer`
- `packages/shared/src/adventurer.ts` — `AdventurerSchema`, `AdventurerClass` enum
- `packages/shared/src/equipment.ts` — `EquipmentSchema` (skillIds/toolIds/mcpServerIds)
- `packages/shared/src/__tests__/*.test.ts` — parse/reject tests for each schema

**Acceptance criteria:**
- Every schema rejects invalid input with a meaningful Zod error
- Status enum values match the DB CHECK constraint values exactly (cross-boundary parity)
- `AdventurerClass` enum values match the DB CHECK constraint values exactly
- `import { QuestSchema } from '@code-quests/shared'` works from both server and client

---


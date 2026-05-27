# Progress — Phase 1

Previous task progress archived to metrics/progress-before-ashford.md

## ashford — Shared types + Zod schemas

- Recreated arundel monorepo scaffolding (source files were missing from this branch; arundel was never merged to main)
- Added `zod` dependency to `@code-quests/shared`
- Created `packages/shared/src/quest.ts` — `QuestStatusSchema`, `QuestSchema`, `EpicSchema` with status enum matching DB CHECK constraint exactly (`idle | active | complete | failed | paused_input | user_blocked`)
- Created `packages/shared/src/adventurer.ts` — `AdventurerClassSchema` (`champion | ranger | scout | rogue | apprentice`), `AdventurerSchema`
- Created `packages/shared/src/equipment.ts` — `EquipmentSchema` (skillIds, toolIds, mcpServerIds)
- Created `packages/shared/src/__tests__/quest.test.ts`, `adventurer.test.ts`, `equipment.test.ts` — parse/reject tests (38 total in shared, 58 total across all packages)
- Added `@code-quests/shared` workspace dependency to both server and client
- All tests pass, all typechecks pass, lint clean

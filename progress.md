# Progress — Phase 3

Previous task progress archived to metrics/progress-before-amethyst.md

## amethyst — SpecAudit schema + quest-API exposure

**Status:** Complete

**What was done:**
- Created `packages/shared/src/spec-audit.ts` with `SpecGapBuildingSchema`, `SpecGapSeveritySchema`, `SpecGapSchema`, `SpecAuditSchema` and inferred types
- Updated `packages/shared/src/quest.ts` to add `specAudit: SpecAuditSchema.nullable().default(null)` to `QuestSchema`
- Updated `packages/shared/src/index.ts` to re-export all new schemas and types
- Created `packages/shared/src/__tests__/spec-audit.test.ts` with 18 tests covering building/severity enum rejection and audit parsing
- Updated `packages/server/src/routes/quests.ts`: extended `QuestRow`, `rowToApi`, `CreateQuestSchema`, PATCH handler all handle `spec_audit_json`
- Updated `packages/server/src/__tests__/quests.test.ts` with 9 new specAudit round-trip tests

**Tests:** 132 total (58 shared + 74 server) — all passing. Typecheck + lint clean.

# Progress — Phase 6

Previous task progress archived to metrics/progress-before-andrea-doria.md

## Task: andrea-doria — Built-in monster types + sprites + seed migration

**Status:** Complete

**What was done:**
- Created `packages/server/src/db/migrations/006_monster_types_seed.sql` — INSERT OR IGNORE for all 10 built-in monster types with correct names, sprite paths, default difficulties, and failure signature patterns.
- Created `packages/server/src/services/monster-types.ts` — exports `BUILTIN_MONSTER_TYPE_IDS`, `MONSTER_PROJECT_ID = 'local'`, `getMonsterType()` (returns undefined for unknown IDs), and `listMonsterTypes()`.
- Generated 10 CC0-stub monster sprite PNGs (48×48 RGB, 4.6–5.9 KB each) under `assets/monsters/` (served via the existing `packages/client/public/assets → assets/` symlink): goblin, imp, wraith, ogre, hydra, mimic, wizard, troll, lich, dragon.
- Updated `assets/CREDITS.md` with Phase 6 Monster Sprites section (Kenney 1-Bit Pack, CC0).
- Created `packages/server/src/db/__tests__/seed-monster-types.test.ts` — 6 tests verifying all 10 IDs seeded with correct difficulty, non-empty sprite paths, failure signatures, `created_by='system'`, and idempotency.
- Created `packages/server/src/services/__tests__/monster-types.test.ts` — 10 tests verifying `BUILTIN_MONSTER_TYPE_IDS` matches DB, `getMonsterType` returns correct data and undefined for unknown IDs, `listMonsterTypes` returns all 10 ordered by difficulty.

**Verify:** All 251 server tests pass. ESLint and tsc both clean.

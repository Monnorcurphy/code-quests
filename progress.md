# Progress — Phase 10

Previous task progress archived to metrics/progress-before-cauvery.md

## Task cauvery — Custom monster types API + detection integration (DONE)

- Migration 009: rebuilt `monster_types` with `CHECK(created_by IN ('system','user'))` using the standard SQLite table-rebuild pattern. Preserves all 10 seeded built-in types.
- `packages/shared/src/monster-type-actions.ts`: `CreateMonsterTypeSchema` with Zod validation including regex validation via `superRefine`.
- `packages/shared/src/index.ts`: re-exported `CreateMonsterTypeSchema` and `CreateMonsterTypeInput`.
- `packages/server/src/services/monster-types.ts`: added `validateFailureSignature(pattern)` helper; updated `listMonsterTypes` sort order so user-defined types are evaluated first in classification.
- `packages/server/src/services/monster-detection.ts`: uses `validateFailureSignature` — invalid regex emits a structured JSON log via stderr and skips (no crash).
- `packages/server/src/routes/monsters.ts`: added `POST /monsters/types` handler — validates body, slugifies name to generate `user:<slug>` id, returns 409 on duplicate, inserts with `created_by='user'`, returns 201 + MonsterType.
- `packages/client/src/lib/api.ts`: added `api.monsters.createType(input)`.
- `packages/server/src/routes/__tests__/monsters-types.test.ts`: happy path, 409 duplicate, 400 invalid regex, 400 out-of-range difficulty, CHECK constraint rejection test.
- `packages/server/src/services/__tests__/monster-detection.test.ts`: two new tests — user type classifies before built-in when both match; invalid user regex is skipped and built-in match still works.
- All 514 tests pass. Typecheck and lint clean.

# Review Pass — Task ashford (Shared types + Zod schemas)

## Checks Performed

- Read all schema source files: `quest.ts`, `adventurer.ts`, `equipment.ts`, `index.ts` and their tests.
- Read DB migration `001_init.sql` and cross-checked enum/CHECK constraints against Zod enums.
- Ran `pnpm typecheck` — pass.
- Ran `pnpm lint` — pass (no warnings, `no-console: error` configured).
- Ran `pnpm test` — pass (58 tests across 3 packages).
- Ran `pnpm build` — pass.
- Grepped for hardcoded secrets (`sk-`, `AKIA`, `api_key=`, `password=`) in `packages/` — none found.
- Verified `re-export` from `@code-quests/shared` works (covered by `packages/shared/src/index.test.ts`).
- Verified `FK pragma` is set in `connection.ts` and a regression test exists (`FK pragma` describe block).

## Cross-Boundary Validation

| Boundary | Status |
|---|---|
| `quests.status` CHECK ↔ `QuestStatusSchema` | MATCH — both list `idle, active, complete, failed, paused_input, user_blocked` |
| `adventurers.class` ↔ `AdventurerClassSchema` | **MISMATCH** — DB has no CHECK constraint, Zod restricts to 5 values. Filed as review-1.md (HIGH) |
| `QuestSchema.equipment` ↔ `EquipmentSchema` | **MISMATCH** — Quest uses `z.record(z.unknown())` instead of the existing `EquipmentSchema`. Filed as review-2.md (HIGH) |
| `monsters.scope` / `monster_encounters.outcome` / `skills.status` | No Zod schema yet — out of scope for task ashford |

## Bugs Filed

- `specs/bugs/review-1.md` — HIGH — `adventurers.class` missing CHECK constraint matching `AdventurerClassSchema`
- `specs/bugs/review-2.md` — HIGH — `QuestSchema.equipment` uses `z.record(z.unknown())` instead of `EquipmentSchema`
- `specs/bugs/review-3.md` — LOW — `connection.test.ts` inserts `'wizard'` and `'paladin'` which aren't in `AdventurerClassSchema`

## Informational Notes

- Phase 1 server only exposes a `/health` route. Capstone coverage is not yet applicable — this is not the last task of the phase, so no dead-end check is required.
- `equipment_json` in `quests` table defaults to `'{}'` (JSON blob). On insert, this stringifies to `{}` and round-trips through `EquipmentSchema.parse({})` cleanly once review-2 is applied. No change needed at the DB layer.
- `createdAt`/`updatedAt` schemas use bare `z.string()` rather than `z.string().datetime()`. Not a bug given Phase 1 scope, but consider tightening when these values cross to the client.
- `progress.md` notes that this task recreated arundel scaffolding. Per Constitution rule #3, factory files (`factory/profile.yaml`) should not be modified by builder/fixer agents; the smoke-test extraction in `factory/profile.yaml` predates this task (commit `8c7825b`), so no action.

## Verdict

**FAIL** — 3 bugs filed (2 HIGH, 1 LOW).

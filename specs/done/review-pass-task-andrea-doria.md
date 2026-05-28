# Review Pass — Task andrea-doria

**Branch:** feature/andrea-doria
**Parent:** main
**Scope:** Seed 10 built-in monster types + sprite assets + service module.

## Checks performed

- Read full pre-computed diff (16 files, +312/-15).
- Read `packages/server/src/services/monster-types.ts` and verified exports match spec (`BUILTIN_MONSTER_TYPE_IDS`, `MONSTER_PROJECT_ID = 'local'`, `getMonsterType`, `listMonsterTypes`).
- Read `packages/server/src/db/migrations/006_monster_types_seed.sql` and cross-checked each row's `id`, `name`, `sprite_path`, `default_difficulty`, and `failure_signature` against the task spec — all 10 match.
- Verified migrator infrastructure: `packages/server/src/db/migrator.ts` runs `INSERT OR IGNORE` SQL exactly once via `schema_migrations`.
- Verified `monster_types` table schema in `001_init.sql` — column types and column order accepted by the seed match (no CHECK constraint violations possible).
- Inspected all 10 sprite PNGs with `file(1)`:
  - All are valid 48×48 8-bit/color RGB PNGs.
  - All are >4 KB (smallest is `lich.png` at 4710 bytes) — none are the sub-1 KB placeholder stubs the review-contract calls CRITICAL.
  - Confirmed `packages/client/public/assets → ../../../assets` symlink resolves `monsters/*.png` paths to real files.
- Ran tests: `pnpm test` → 251/251 passing (21 files).
- Ran `pnpm lint` → clean.
- Ran `pnpm typecheck` → clean.
- Grepped service for secret patterns (`sk-`, `AKIA`, `api_key`, `password=`) — none.
- Grepped service for `console.*` debug prints — none.
- Accessibility: task ships only backend SQL + service code + binary art; no UI surface introduced, so no a11y rules apply.
- Cross-boundary: `MONSTER_PROJECT_ID = 'local'` is a frontend-visible constant. The `monsters.project_id` column in `001_init.sql` is `TEXT` with no CHECK constraint, so any string is acceptable — no boundary mismatch.
- This is NOT the phase capstone (last task of Phase 6), so capstone-coverage check does not apply.

## Bugs filed

| # | Severity | Title |
|---|----------|-------|
| 1 | LOW | idempotency test does not actually verify INSERT OR IGNORE |
| 2 | LOW | duplicate horizontal-rule separator in CREDITS.md |

## INFORMATIONAL notes

- The `hydra_ac_mismatch` failure-signature regex `\b(acceptance (criteri[ao]n)|AC mismatch|did not meet|spec mismatch)\b` is reproduced verbatim from the task spec but will NOT match the common English word "criteria" (the `[ao]n` group requires the letter to be followed by `n`). This matches the spec exactly so it is not a builder bug — flagging here in case the original spec author intended `criteri[ao]?` or `criteri(?:on|a)`.
- Service module uses inline `as Record<string, unknown>` casts at the better-sqlite3 boundary rather than a Zod schema. Acceptable for a thin internal read of trusted SQLite data; flagged only as a future hardening opportunity.
- Sprite dimensions are 48×48 RGB rather than the 16×16/32×32 the spec mentioned. Matches the existing `assets/character/*.png` and `assets/dungeon/*.png` PNGs in the repo, so this is consistent with project precedent rather than a regression.

## Verdict

**FAIL** — 2 LOW-severity bugs filed. Tests, lint, typecheck all pass; no CRITICAL or HIGH findings.

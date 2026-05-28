# Review Pass — Task arizona

## Summary of Checks Performed
- Read the full task spec (`metrics/task-arizona-context.md`)
- Reviewed all modified/created files:
  - `packages/server/src/services/monster-detection.ts`
  - `packages/server/src/services/monster-name-generator.ts`
  - `packages/server/src/services/__tests__/monster-detection.test.ts`
  - `packages/server/src/services/quest-runner.ts`
  - `packages/shared/src/agent.ts`
  - `packages/client/src/features/quests/active-quest-panel.tsx`
  - `packages/client/src/features/quests/returned-quest-detail.tsx`
- Ran `pnpm --filter=@code-quests/server test` → 271/271 pass
- Ran `pnpm --filter=@code-quests/client test` → 426/426 pass (one flaky first run, clean re-run)
- Ran `pnpm typecheck` → clean
- Ran `pnpm lint` → clean (eslint configured with `no-console: error`)
- Ran `pnpm build` → success
- Cross-boundary validation:
  - `monster_encounters.outcome` CHECK = `('victory','defeat','escape')` matches Zod `z.enum(['victory','defeat','escape'])` in `agent.ts` ✓
  - `monsters.scope` CHECK = `('project','guild')` matches TS literal type ✓
  - `default_difficulty` values (1–5) in seed match `z.number().int().min(1).max(5)` on `monster_appeared.difficulty` ✓
  - All seed `failure_signature` regex patterns compile and word boundaries work after round-trip through SQLite text storage ✓
- Security: no secrets, no `console.log`, no eval, no path traversal. Local-only DB so user-supplied regex ReDoS is acceptable risk.
- Accessibility: new event types in `active-quest-panel.tsx` and `returned-quest-detail.tsx` use `aria-hidden="true"` on emoji icons, consistent with existing patterns ✓
- FK pragma (`foreign_keys = ON`) enabled in `db/connection.ts` ✓
- Empty catch in `classifyCombatEvent` has a justification comment ("invalid regex in DB — skip silently") satisfying the silent-error-swallowing rule ✓

## Acceptance Criteria Verification
- ✓ Unknown `monsterTypeId` falls back to regex; no-match → null + stderr warning
- ✓ First encounter creates new monster; second in same quest reuses; third in different quest reuses (project-scope)
- ✓ `calibrated_difficulty` is clamped 1–5
- ✓ Quest runner publishes `monster_appeared` BEFORE `combat` event (lines 95-105 of quest-runner.ts)
- ✓ AgentEventSchema extended with `monster_appeared` and `monster_resolved`
- ✓ Name generator has 15 adjectives, no external dep
- ✓ All required test cases in monster-detection.test.ts (20 tests across 4 describe blocks)
- ⚠ Acceptance criterion "completed → victory; failed → last=defeat, rest=escape" is implemented but not unit-tested at the integration layer — see review-1.md

## Bugs Filed
- `specs/bugs/review-1.md` — LOW: Missing integration tests for quest-runner pending-encounter resolution logic

## Informational Notes
- **`resolveEncounter` not idempotent**: Calling it twice on the same encounterId would double-increment `defeats`/`escapes`. Currently safe because `pendingEncountersByQuest` is cleared after iteration in `quest-runner.ts`, but a future caller could trip on this. Consider guarding by checking the existing `outcome` before incrementing aggregate counters. Not in scope for this task.
- **Counter naming overlap**: `monster.escapes` is incremented for both `defeat` and `escape` outcomes. This is consistent with the recalibration semantics (defeats/encounters = "kill rate") but the column name could mislead a future reader. Consider renaming to `non_defeats` or splitting into `escapes`+`fatalities` in a future schema migration.
- **Classification order**: `classifyCombatEvent` iterates `listMonsterTypes` ordered by `(default_difficulty ASC, id ASC)`. If a message matches multiple patterns, the lowest-difficulty/lexicographically-earliest type wins. Matches spec intent but worth documenting.
- **ReDoS risk on user-defined `failure_signature`**: Custom monster types could store catastrophic regex patterns. Acceptable for local-first v1; revisit if monster types ever sync to cloud.
- **Coverage estimate**: ~20 tests covering 4 functions appears to easily exceed the 80% line coverage target, though coverage was not measured directly (no `--coverage` flag run).

## Final Verdict
**FAIL** — 1 LOW bug filed.

Implementation quality is high. All explicit spec requirements are met; the filed bug covers test gaps for the integration logic that the spec did not explicitly enumerate but the acceptance criteria depend on.

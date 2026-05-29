# Review Pass — TASK catalpa (Auto-match scar-aware scoring)

**Verdict:** PASS (0 bugs filed, 4 INFORMATIONAL notes)

## Summary of checks performed

- Re-read the pre-computed diff (4 files changed: routes/quests.ts, services/auto-match.ts, services/__tests__/auto-match.test.ts, progress.md)
- Read `services/auto-match.ts` in full (current state on branch)
- Read `services/__tests__/auto-match.test.ts` in full
- Read `routes/quests.ts` call-site for auto-match (lines 370–430)
- Cross-referenced shared types (`Monster`, `MonsterType`, `ScarRecord`) in `packages/shared/src/monster.ts`
- Compared regex/monster-type logic against pre-existing `services/monster-detection.ts` (Phase 4) for consistency
- Verified DB schema for `monsters` table (`packages/server/src/db/migrations/001_init.sql:66`) against route mapping
- Ran `pnpm -F @code-quests/server test` → 470/470 pass
- Ran `pnpm -F @code-quests/server typecheck` → clean
- Ran `pnpm -F @code-quests/server lint` → clean (no errors, no warnings)
- Grepped for secrets (`sk-`, `AKIA`, `api_key`, `password=`) → none
- Verified spec acceptance criteria:
  - ✅ All Phase 4 auto-match tests still pass (regression suite untouched)
  - ✅ New tests cover scar matches, non-matches, cap behaviour, no-scars baseline
  - ✅ Structured log line emits `scarPenalty: -N` via the optional `logger` callback
  - ✅ No new dependencies
  - ✅ Cyclomatic complexity of every helper stays ≤ 15

## INFORMATIONAL notes

### 1. Route synthesizes placeholder Monster objects (cosmetic)

`packages/server/src/routes/quests.ts:395-409` builds `Monster[]` from a slim
`SELECT id, type_id FROM monsters` query, filling required fields with placeholders
(`name: ''`, `scope: 'project' as const`, `firstSeenAt: ''`, etc.). Auto-match only
reads `m.id` and `m.typeId`, so the placeholders are never observed at runtime — but
the `scope` cast is misleading because the DB column is `CHECK(scope IN ('project',
'guild'))` and may legitimately be `'guild'`.

Consider tightening `AutoMatchOptions.monsters` to `Pick<Monster, 'id' | 'typeId'>[]`
(or a dedicated `MonsterLookup` interface) so the call-site can build honest minimal
objects instead of cast-laden fakes. Non-breaking; cleanup for a future pass.

### 2. `tokenOverlapRatio` does not filter stop words

Words are extracted via `/\w+/g` with no stop-word list. Set deduplication on the
scar summary side mitigates the worst case (a scar summary of `"the build the the"`
collapses to `{the, build}`), but a generic scar summary like `"the test failed in
the api"` could still cross the 50% threshold against unrelated quest text. Current
behaviour is acceptable as a v1 heuristic and matches the spec's "lightweight
bag-of-words match"; revisit if false-positive penalties show up in transcripts.

### 3. Silent regex catch in `predictDominantMonsterTypeId`

`auto-match.ts:47-49` swallows invalid-regex throws with `// skip invalid regex`.
This mirrors the existing pattern in `services/monster-detection.ts:95-97` and is
defensible (a malformed signature in one row should not break match scoring), but
neither site surfaces the bad pattern. Future improvement: log the offending
`MonsterType.id` to stderr the same way `monster-detection.ts:100-102` reports
unmatched messages, so admins can find and repair the bad row.

### 4. O(n) monster lookup per scar per adventurer

`scarMatchesQuest` calls `monsters.find((m) => m.id === scar.monsterIdAtFatal)` for
every scar of every available adventurer. Wall-clock impact is negligible at current
guild + scar + monster counts. If guild size grows, consider building a
`Map<string, Monster>` once inside `computeScarPenalty` (or hoist into `autoMatch`)
to amortize lookups.

## Boundary checks

- DB column `monsters.scope` → route maps to literal `'project'`. Mismatch is benign
  because the field is never read by auto-match. Noted under INFORMATIONAL #1.
- `MonsterType.failureSignature` is user-supplied regex text; invalid patterns are
  caught and skipped (no crash). See INFORMATIONAL #3.
- No new IPC, HTTP, or DB boundary surfaces introduced; the new `AutoMatchOptions`
  parameter is in-process only.

## Capstone coverage

N/A — catalpa is a backend service extension, not a phase capstone. Spec confirms
"backend only, pure scoring logic".

## Final Verdict

**PASS** — 0 bugs filed. All acceptance criteria met. Tests, typecheck, and lint
are clean.

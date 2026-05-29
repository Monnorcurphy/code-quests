# Review Pass — castillo-de-san-marcos (auto-match service)

**Verdict:** PASS (0 bugs filed)

## Scope

Reviewed the diff for TASK castillo-de-san-marcos on branch `feature/castillo-de-san-marcos`:

- `packages/server/src/services/auto-match.ts` (new, 61 lines)
- `packages/server/src/services/__tests__/auto-match.test.ts` (new, 256 lines)
- `packages/server/src/routes/quests.ts` (extended `POST /quests/:id/dispatch`)
- `packages/server/src/__tests__/dispatch.test.ts` (5 new test cases)

## Checks Performed

1. **Tests** — `pnpm --filter @code-quests/server test` → 175 passed, 15 files. ✓
2. **Typecheck** — `pnpm typecheck` (workspace) → clean. ✓
3. **Lint** — `pnpm lint` (workspace) → clean. ✓
4. **Secrets** — grep for `sk-`, `AKIA`, `api_key=`, `password=` in new files → none. ✓
5. **Cross-boundary validation:**
   - DB `adventurers.class` CHECK enum (`champion|ranger|scout|rogue|apprentice`) ↔ `AdventurerClassSchema` → exact match. ✓
   - `quests.adventurer_id` FK → write-back uses an id read from `adventurers` in the same request, so referential integrity holds. ✓
   - DB columns (`stats_json`, `specializations_json`, `scars_json`, `ended_at`, `pid`, `exit_code`) ↔ schemas (`AdventurerSchema`, `AgentSchema`) → mapped correctly in the route. ✓
6. **Spec conformance:**
   - Exclude busy adventurers (agents with `ended_at IS NULL`) ✓
   - Class fit thresholds (champion ≥6 equipment OR ≥5 ACs OR ≥600 description; scout ≤1 equipment AND <200 description; ranger default) ✓
   - Specialization substring match against description + ACs, case-insensitive ✓
   - Tiebreak: spec match (×2) beats class match (×1), then `questsWon − questsLost`, then `createdAt` ascending ✓
   - Returns `null` when guild empty or all busy ✓
   - Determinism — no `Math.random`, no `Date.now()`, ISO timestamps sort lexicographically same as chronologically ✓
   - Route precedence: body.adventurerId → row.adventurer_id → autoMatch → 409 `NO_ADVENTURER` ✓
   - Persists chosen adventurer before audit/transition logic runs ✓
   - 400 when body adventurerId references non-existent adventurer ✓
7. **Tests cover all rule paths** — null returns, busy exclusion (null vs non-null `endedAt`), all three class buckets, fallback when preferred class absent, spec match (description and AC), case-insensitivity, spec+class > spec-only > class-only, net-score tiebreak, createdAt tiebreak, missing-stats default, determinism. ✓
8. **No debug output**, no `console.log` in production paths (errors logged via `process.stderr.write`). ✓
9. **Code-quality limits** — `auto-match.ts` is 61 lines, every function ≤ ~12 LOC, max nesting 1, ≤3 params per signature. ✓

## Informational Notes (not bugs)

1. **Empty-string specialization edge case**: `hasSpecMatch` uses `haystack.includes(spec.toLowerCase())`. If an adventurer ever ended up with `''` in their `specializations` array, `''.includes` would always return true and that adventurer would always receive the +2 spec bonus. The shared `AdventurerSchema` allows `z.array(z.string())` without a `.min(1)` on the inner string. Likelihood is low because catalog-driven inputs won't produce empty strings, and the spec does not forbid them — flag for future hardening only.
2. **Body `bypass: boolean` is accepted but not directly tested**: the spec lists it as part of the dispatch body and the route parses it. The existing `?bypass=true` query path is exercised by tests; the body bypass form is not. Adding a single test would close the gap, but the behavior is correct as written.
3. **Concurrent dispatch double-booking**: Two parallel dispatches to *different* idle quests could both pick the same available adventurer (no transaction, no DB-level uniqueness on `quests.adventurer_id`). Out of scope for this task; agent-lifecycle work in later phases is the natural place to address it.
4. **`PreferredClass` is `'champion' | 'ranger' | 'scout'`** — by design (only those three classes have explicit "prefer" rules). Other classes (`rogue`, `apprentice`) can still be selected when no preferred-class adventurer is available, via the fallback path. Matches spec.

## Verdict

PASS — implementation matches the spec, tests are comprehensive, all gates green, no boundary mismatches.

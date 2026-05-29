# Progress — Phase 9

Previous task progress archived to metrics/progress-before-catalpa.md

## catalpa — Auto-match scar-aware scoring (backend)

- Extended `packages/server/src/services/auto-match.ts` with scar-aware scoring
  - Added `AutoMatchOptions` interface (`monsters`, `monsterTypes`, `logger` callback)
  - Added `predictDominantMonsterTypeId` — tests quest text against `MonsterType.failureSignature` patterns
  - Added `tokenOverlapRatio` — bag-of-words overlap ratio
  - Added `scarMatchesQuest` — matches via monster type OR ≥50% token overlap
  - Added `computeScarPenalty` — -15 per matching scar, capped at -30
  - `autoMatch` accepts optional 4th `options` parameter; calls `logger` with `{ adventurerId, scarPenalty }` when penalty is non-zero
- Updated `packages/server/src/routes/quests.ts` auto-match call site to fetch monsters + monsterTypes from DB and pass with a `process.stdout.write` logger
- Extended `packages/server/src/services/__tests__/auto-match.test.ts` with scar penalty test suite:
  - No-scar baseline (no penalty)
  - Token overlap matching (penalises) and non-matching (no penalty)
  - Monster type matching (penalises) and wrong type (no penalty)
  - Cap behaviour (3 scars → -30, not -45)
  - Logger callback called/not-called correctly
- All 470 tests pass; typecheck and lint clean

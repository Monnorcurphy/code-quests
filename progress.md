# Progress — Phase 4

Previous task progress archived to metrics/progress-before-castillo-de-san-marcos.md

## castillo-de-san-marcos — Auto-match service

**Status:** Done

**What was built:**
- `packages/server/src/services/auto-match.ts` — `autoMatch(quest, guild, activeAgents)` function implementing the 4-rule selection algorithm: exclude busy, class fit, specialization match, tiebreak by net wins then createdAt
- `packages/server/src/services/__tests__/auto-match.test.ts` — 20 table-driven tests covering all rule paths and the null-return case
- `packages/server/src/routes/quests.ts` — Extended `POST /quests/:id/dispatch` to resolve adventurer before audit: body `adventurerId` (with 400 validation), pre-assigned quest adventurerId, then autoMatch(), then 409 NO_ADVENTURER if none available
- `packages/server/src/__tests__/dispatch.test.ts` — Added 5 new cases: auto-match, body adventurerId override, bad adventurerId 400, NO_ADVENTURER 409, pre-assigned adventurerId

**Verification:** 175 tests pass, 0 lint errors, 0 typecheck errors

# Progress — Phase 11

Previous task progress archived to metrics/progress-before-cancer.md

## Task cancer — Failure → scar → re-post loop integration

**Status:** Complete

**What was done:**
- Server: Added `monsterTypeId` to the fatal monster JSON in the Hall of Returns list query
- Server: Created `packages/server/src/__tests__/repost-cycle.test.ts` — full integration test covering the fail→scar→repost→complete arc using the seeded showcase scenario (Brielle dispatched without type_whisperer, fails, gains scar, re-post adds type_whisperer, quest completes)
- Server: Added showcase seed scenario test to `quest-return.test.ts` — verifies scar shape (questId, failureSummary, monsterIdAtFatal, occurredAt) using seeded Brielle adventurer data
- Server: Added unit test to `auto-match.test.ts` — verifies Brielle's JWT scar lowers her score for a type-heavy future quest, causing a clean champion newcomer to be selected instead
- Client: Added `monsterTypeId` to `FatalMonsterSchema` in `api.ts`
- Client: Added `equipment` field to `HallOfReturnsQuestSchema` in `api.ts`
- Client: Extended `api.quests.repost` to accept `equipment` in adjustments
- Client: Updated `failure-summary-card.tsx` — "Browse Library" link now points to `/town/library?typeId=xxx` filtered to the fatal monster's type
- Client: Updated `repost-dialog.tsx` — added inline skills equipment-edit section with constrained checkbox pickers (pre-populated from quest's existing equipment), passes equipment in the repost API call
- Client: Updated `bestiary.tsx` — accepts `initialTypeFilter` prop, filters monster list by typeId, shows a filter banner when active
- Client: Updated `library.tsx` — reads `typeId` from `useSearchParams()` and passes to `Bestiary` as `initialTypeFilter`
- Tests: Updated `repost-dialog.test.tsx` to cover equipment section (skills API mock, checkbox toggle, pre-population, submission with equipment)
- Tests: Fixed 5 test fixtures to add new required fields (`equipment`, `monsterTypeId`)
- Tests: Fixed `library.test.tsx` to wrap renders in `MemoryRouter` (required by new `useSearchParams` call)

**Acceptance criteria met:**
- ✅ Integration test passes deterministically
- ✅ Hall of Returns failure summary shows non-empty recommendation text and links to bestiary filtered by monster type
- ✅ Re-post inline equipment editor uses constrained inputs (checkboxes, not free text)
- ✅ Scar persists on adventurer across re-post + win
- ✅ Auto-match considers scars (verified by unit test)
- ✅ All 1542 tests pass (551 server, 991 client)
- ✅ Lint, typecheck, all green

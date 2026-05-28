# Progress — Phase 5

Previous task progress archived to metrics/progress-before-greatsword.md

## greatsword — Phase 5 Capstone (DONE)

**Goal:** Make Phase 5 demo-able by a human — wire quest dispatch into quest scene navigation, add Enter Quest / Watch Quest affordances, E2E test, test-only server emit endpoint, seed extension, README update.

**What was done:**
- Extracted `return-to-town-button.tsx` from HUD overlay; reads `useTownStore` to preserve last visited town scene
- Added "Enter Quest" button to `quest-board.tsx` for active quests (navigates to `/quest/:questId`)
- Added "Watch Quest" button to `war-room.tsx` — enabled for active quests, disabled with "Dispatch first" tooltip for idle
- Extended `seed-dev.ts` with NODE_ENV production guard and Phase 5 demo quest ("Cave Expedition", status=active, quest-cave scene) with a live agent record
- Created `routes/test-emit.ts` — POST `/test/emit-quest-event` endpoint, mounted only when `NODE_ENV=test`
- Mounted test-emit route in `index.ts` behind `NODE_ENV === 'test'` guard
- Updated `playwright.config.ts` to set `NODE_ENV=test` for server webServer
- Created `phase-5-capstone.spec.ts` — 6 E2E tests: full walkthrough, two a11y scans (axe-core), test-emit endpoint, Enter Quest button, Watch Quest button
- Added Phase 5 section + walkthrough to README.md; updated phase roadmap table
- Fixed `quest-board.test.tsx` to wrap `QuestBoard` in `MemoryRouter` (required after adding `useNavigate`)

**Verification:** `pnpm typecheck` ✓, `pnpm lint` ✓, `pnpm test` 426/426 ✓

# Progress — Phase 1

Previous task progress archived to metrics/progress-before-caernarfon.md

## caernarfon — Quest draft flow + Quest Board (CAPSTONE) ✅

**Completed:** 2026-05-26

**What was built:**
- `packages/client/src/features/quests/draft-form.tsx` — Quest draft form (title, description, AC list with add/remove, optional epic dropdown). Full 3-state UX.
- `packages/client/src/features/quests/quest-board.tsx` — Quest Board listing quests with Drafted/Active/etc. status badges, empty state, keyboard-accessible scrollable list.
- `packages/client/src/features/war-room.tsx` — War Room building modal embedding the draft form.
- `packages/client/src/features/town-square.tsx` — Extended to show Quest Board front-and-center above the roster.
- `packages/client/src/lib/api.ts` — Added `quests.create` POST method.
- `packages/client/src/routes/town.tsx` — War Room now opens the real draft form.
- `packages/server/src/scripts/seed-dev.ts` — Dev seed script (1 epic, 1 adventurer, 2 quests).
- `README.md` — Install/run instructions.
- `assets/CREDITS.md` — Initialized.
- `packages/client/tests/e2e/phase-1-capstone.spec.ts` — 7 Playwright tests covering full walkthrough + axe-core a11y scans.
- `playwright.config.ts` — Root Playwright config.

**Test results:** 115 unit tests + 7 E2E tests all pass. ESLint + tsc clean.

**Accessibility:** All four key surfaces (Town, Town Square, War Room, draft form) pass axe-core zero-violations scan. Fixed `scrollable-region-focusable` on roster list and quest board list by adding `tabIndex={0}`.

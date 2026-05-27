# Progress — Phase 4

Previous task progress archived to metrics/progress-before-golconda.md

## golconda — Phase 4 capstone (complete)

- Extended `seed-dev.ts`: added fully-specified capstone demo quest + pre-completed "Banish the Memory Leak" quest with agent row and events_json
- Added `ReturnedQuestsBadge` to `town-square.tsx`: shows "X quests returned" badge linking to Hall of Returns when count > 0
- Created `phase-4-capstone.spec.ts`: full E2E — dispatch → offline adapter completes → Hall of Returns → detail modal; axe checks on Hall of Returns, detail modal, active-quest panel, and Town Square peek
- Created `phase-4-cancel.spec.ts`: create active quest via PATCH, cancel via UI confirm dialog, verify failed + retire recommendation; axe check on failed detail
- Updated `README.md` with Phase 4 walkthrough section (offline demo + real CC adapter instructions)
- Created `specs/done/phase-4-complete.md` phase summary
- All 204 server tests + 324 client tests pass; typecheck and lint clean

# Progress — Phase 6

Previous task progress archived to metrics/progress-before-golden-hind.md

## Task: golden-hind — Phase 6 Capstone (complete)

**Lich aggregator (quest-runner.ts)**
- Added `typeCountsByQuest` map to track per-type encounter counts per quest
- After `LICH_REPEAT_THRESHOLD` (3) encounters of same non-lich type, auto-spawns a Lich encounter
- Properly cleans up on quest completion/failure via `finally` block
- 3 new integration tests cover: spawns lich, two distinct types each spawn lich, no lich below threshold

**Promote-to-nemesis (server + client)**
- `POST /monsters/:id/promote-nemesis` endpoint: validates monster exists, not already guild, optional name rename
- Client `api.monsters.promoteNemesis(id, name?)` calls postJson
- `MonsterDetail` component: "Mark as Nemesis" button (visible only for project-scope monsters), confirmation modal with name pre-fill, success toast auto-dismiss at 4s
- 5 new server-side unit tests + E2E coverage

**Bestiary scope filter**
- Added "Mine (Project)" / "Nemeses (Guild)" tab bar to `bestiary.tsx`
- Query changes based on active scope tab
- Guild empty state with helpful "promote from Mine tab" hint
- 4 new unit tests for the tabs

**Library discoverability**
- `library.tsx` now fetches monster count and shows "Bestiary unlocked — N monsters logged" badge in header
- `town-square.tsx` adds `LibraryPreview` component in the sidebar showing the same badge + "Open Library" button
- `library/library-scene.tsx` created as a re-export pointer

**Demo seed + replay scripts**
- `seed-demo-quest.ts`: idempotent, creates Phase 6 demo quest (complete) with Imp×3, Goblin×1, Wraith×1, Lich×1 monsters and all encounters pre-populated
- `replay-failures.ts`: finds idle demo quest (auto-creates if none), replays scripted fixture events through monster-detection pipeline, lich aggregator triggers correctly in output

**E2E test** (`phase-6-capstone.spec.ts`)
- 10 test scenarios covering: Library nav, Bestiary tab discoverability, scope filter tabs, seeded monsters visible, monster detail with promote button, promote flow, Nemeses tab, axe violations check, library badge, town square library card, demo quest in DB, persistence after refresh, combat HUD axe scan

**Other**
- `global-setup.ts` updated to also run `seed-demo-quest.ts`
- `README.md` updated with full Phase 6 section (walkthrough, replay, building overview, phase roadmap updated to show Phase 6 Done)
- `specs/done/phase-6-walkthrough.md` created with full interaction path, reachability audit, cross-boundary parity table

**Verify results**: 301 server tests ✓, 559 client tests ✓, 58 shared tests ✓, lint ✓, typecheck ✓

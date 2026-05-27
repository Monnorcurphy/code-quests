# Progress — Phase 2

Previous task progress archived to metrics/progress-before-elephant.md

## Task elephant — Town Square scene (entry + Quest Board + recruit banner)

**Status:** Done

**What was built:**
- `TownSquareScene` — extends `BaseTownScene`; 3200px wide; 7 building doors; `QuestBoardInteractive` + `RecruitBannerInteractive` at center; player spawns at x=1600; sign-post labels above each door
- `QuestBoardInteractive` — Phaser entity with proximity detection; activates → `setActiveModal('quest-board')`
- `RecruitBannerInteractive` — same pattern; activates → `setActiveModal('recruit')`
- `PlaceholderScene` factory — registers placeholder Phaser scenes for all 7 buildings (war-room, oracle, library, tavern, armory, guild-hall, hall-of-returns); shows building name + Escape to return
- `features/town-square.tsx` — refactored from Phase 1 modal into a store-driven HUD overlay; renders `QuestBoardPanel` or `RecruitPanel` based on `town-store.activeModal`; works in both HTML (opened by building button) and Phaser (triggered by scene interactive) modes
- `stores/town-store.ts` — added `'quest-board'` to `activeModal` type; added `setActiveModal` action
- `game/game-config.ts` — imports all scene files so Phaser game includes all registered scenes
- `BaseTownScene` — added `protected get sceneWidth()` hook so subclasses can override the default 2400px width
- `scene-keyboard-nav` mirror for Town Square: Quest Board, Recruit Banner + 7 Door labels

**Tests added:**
- `src/game/scenes/__tests__/town-square-scene.test.ts` — 13 unit tests: scene key, defaultSpawnX, sceneWidth, door count, door targets, interactive labels, activations, shutdown cleanup, update pause
- `tests/e2e/town-square.spec.ts` — 9 Playwright tests covering: open, quest board visibility, recruit modal flow, Escape close, cancel return, empty state, accessibility (zero violations)

**Acceptance criteria status:**
- ✅ Town Square scene renders with 7 doors and 2 interactives
- ✅ Player spawns at center (1600)
- ✅ Quest Board + Escape → HUD overlay opens/closes
- ✅ Recruit Banner → recruit modal; POST to /adventurers still works
- ✅ 7 doors → placeholder scenes showing building name
- ✅ scene-keyboard-nav mirror: Quest Board, Recruit Banner, Door: War Room, etc.
- ✅ Phase 1 capstone E2E tests still pass (HTML mode unchanged, store cleanup added)
- ✅ Zero axe-core violations

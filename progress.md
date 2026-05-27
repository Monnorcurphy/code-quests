# Progress — Phase 2

Previous task progress archived to metrics/progress-before-fox.md

## Task fox — Seven interior building scenes

**Status:** DONE

**What was built:**
- `BaseBuildingScene` (abstract) — shared base for all 7 interior scenes (sceneWidth=1280, return door at x=200, sign text helper)
- `WarRoomScene` — interior with planning table interactive; triggers `activeModal='draft'` to open draft form HUD overlay
- `GuildHallScene` — interior with guild roster interactive; triggers `activeModal='guild-hall'` to open roster+recruit HUD overlay
- `OracleScene`, `LibraryScene`, `TavernScene`, `ArmoryScene`, `HallOfReturnsScene` — placeholder interiors with unique backgrounds/décor; auto-show `coming-soon` panel on enter
- `ComingSoonPanel` component — parchment-style dialog with title, description, and "Return to Town Square" button; keyboard-dismissable via Escape
- `war-room.tsx` — refactored to store-driven HUD overlay (subscribes to `activeModal==='draft'`, no onClose prop)
- `guild-hall.tsx` — refactored to store-driven HUD overlay (subscribes to `activeModal==='guild-hall'`, no onClose prop)
- `town.tsx` — updated HtmlTown to use store for war-room/guild-hall triggers with proper focus-return; updated PhaserTown to render WarRoom, GuildHall, ComingSoonPanel overlays
- `town-store.ts` — added `'guild-hall' | 'coming-soon'` to activeModal union type
- `game-config.ts` — imports all 7 new scene files (removed placeholder-scene import)
- `placeholder-scene.ts` — deleted (replaced by 7 individual scene files)
- Unit tests: 47 new tests in `all-buildings.test.ts` covering all 7 scenes
- E2E tests: 25 new tests in `all-buildings.spec.ts`

**Verify:** 184/184 unit tests pass, 42/42 E2E tests pass, typecheck clean, lint clean

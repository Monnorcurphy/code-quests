# Progress — Phase 3

Previous task progress archived to metrics/progress-before-diamond.md

## diamond — Armory equipment picker (Phaser interactive + HUD overlay)

**Status:** Complete

**What was built:**
- `packages/client/src/game/interactives/equipment-station.ts` — New Phaser interactive for the Armory's Loadout Workbench. Follows quest-board.ts pattern: proximity highlight, `registerWithPlayer`, activates `armory-loadout` modal on interact.
- `packages/client/src/game/scenes/armory-scene.ts` — Updated to mount `EquipmentStationInteractive` at centre, removed auto-open of `coming-soon`, added `update()` override to track player position. Registers both `town-square` (return door) and `armory-loadout` interactives.
- `packages/client/src/stores/town-store.ts` — Added `selectedQuestId: string | null` + `setSelectedQuestId`, added `'armory-loadout'` to `activeModal` union.
- `packages/client/src/lib/api.ts` — Added `patchJson` helper, `api.equipment.{skills,tools,mcpServers}`, `api.quests.{get,patch}`, and `PatchQuestInput` type.
- `packages/client/src/features/armory/use-equipment-mutation.ts` — TanStack `useMutation` that calls `api.quests.patch` and invalidates `['quests']` cache on success.
- `packages/client/src/features/armory/loadout-panel.tsx` — Main component: three multi-select columns (Skills, Tools, MCP Servers) from catalog APIs, pre-populates from quest's existing equipment, three UX states (loading/success auto-dismiss 3s/error persists), keyboard accessible via focus trap, aria-live success announcement.
- `packages/client/src/components/hud-overlay-manager.tsx` — Registered `armory-loadout` overlay, removed armory from `COMING_SOON_CONTENT`, added `LoadoutPanel` render case.
- `packages/client/src/styles/features.css` — Added armory panel CSS (3-column grid, responsive, reduced-motion aware).
- `packages/client/src/__tests__/loadout-panel.test.tsx` — 10 tests covering: three columns render, catalog items appear, checkbox toggle + save calls correct API payload, success aria-live, success auto-dismisses after 3s, error persists, no quest selected message, pre-populate from existing equipment, close button, saving disables button.
- Updated `all-buildings.test.ts` — Moved ArmoryScene out of PLACEHOLDER_SCENES, added dedicated describe block with 6 tests for new interactive behavior.
- Updated `hud-overlay-manager.test.tsx` — Added armory-loadout test, updated API mock to include equipment and quests.patch.

**Tests:** 375 total (58 shared + 101 server + 216 client), all passing.

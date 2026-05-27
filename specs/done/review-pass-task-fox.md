# Review Pass — Task fox (Seven interior building scenes)

## Checks Performed

### Build / Verify
- `pnpm test` (vitest): **184/184 pass** (47 new tests in `all-buildings.test.ts`)
- `pnpm typecheck`: **clean** (shared + server + client)
- `pnpm lint` (ESLint, root config with `no-console: error`): **clean**
- Verify report `metrics/verify-2026-05-27_01-03.txt`: build PASS, test PASS, typecheck PASS, lint PASS, smoke PASS

### Security
- `grep -nE "sk-|AKIA|api_key|password="` in `packages/client/src` → no matches
- No `new Function()` / `eval()` introduced
- No telemetry or external network calls added

### Accessibility / Contrast
- `grep -nE "text-(gray|neutral|slate|zinc)-(100|200|300|400)|border-gray-(100|200|300)"` in `packages/client/src` → no matches (no banned Tailwind classes; project uses CSS classes, not Tailwind)
- All new dialogs (`<ComingSoonPanel>`, refactored `<WarRoom>` and `<GuildHall>`) use `role="dialog"`, `aria-modal="true"`, `aria-labelledby` referencing the `<h2>` title id
- All new dialogs use `useFocusTrap` (Escape closes, Tab cycles within)
- Each new dialog focuses a button on mount via mount-only `useEffect(..., [])` — matches `state-conventions.md` "Focus must NOT re-snap on every parent re-render"
- E2E suite contains explicit `axe-core` checks for every placeholder dialog (`all placeholder building dialogs have no accessibility violations` test)

### Cross-Boundary Validation
- `activeModal` union (`town-store.ts`): `'recruit' | 'draft' | 'quest-board' | 'guild-hall' | 'coming-soon' | null`
- All values set by scenes (`'draft'` in war-room-scene, `'guild-hall'` in guild-hall-scene, `'coming-soon'` in the 5 placeholder scenes) are valid union members. Confirmed by grep.
- `SceneKey` ↔ `TownSceneKey` ↔ `BUILDINGS` list ↔ Town Square scene's `DOOR_CONFIGS` ↔ scene-registry calls: all eight keys (`town-square`, `war-room`, `oracle`, `library`, `tavern`, `armory`, `guild-hall`, `hall-of-returns`) appear consistently across boundaries.
- No SQL / DB constraints touched in this task — no DB cross-boundary surface to check.

### Acceptance Criteria Trace
- [x] Each of the 7 scenes loads from URL `/town/<scene-key>` — `PhaserTown` uses `isTownSceneKey` + `mountScene.current` + `goToScene`
- [x] Each scene reachable from a Town Square door — `town-square-scene.ts` `DOOR_CONFIGS` covers all 7
- [x] War Room interact opens draft form — `planning-table` interactive + `player.onInteract` callback set `activeModal='draft'`; Phase 1 `/quests` API path unchanged
- [x] Guild Hall interact opens roster+recruit — `guild-roster` interactive sets `activeModal='guild-hall'`
- [x] 5 placeholder scenes show coming-soon panel with Phase N reference — `COMING_SOON_CONTENT` map in `town.tsx` (Oracle/Tavern/Armory = 3, Hall of Returns = 9, Library = 10)
- [x] Every scene has return door at left edge (x=200) — enforced by `BaseBuildingScene.RETURN_DOOR`
- [x] Each scene has scene-keyboard-nav mirror — base scene + subclasses both call `sceneRouter.setInteractives(...)`
- [x] Unique background art per scene — each scene sets its own background color and decorative geometry
- [x] Axe-core zero violations — covered by E2E `all placeholder building dialogs have no accessibility violations`

### Architecture Sanity
- `WarRoomScene.update()` and `GuildHallScene.update()` early-return when `activeModal !== null` → input is correctly frozen while a HUD is open (controller events aren't emitted, player can't drift).
- Both `War Room` and `Guild Hall` features were refactored from prop-driven `onClose` to store-driven (`useTownStore((s) => s.setActiveModal)`), consistent with state-conventions.md (store actions are the boundary, components subscribe).
- `town-store` activeModal type was extended (`'guild-hall'` and `'coming-soon'` added).

## Bugs Filed

| # | Severity | Title |
|---|----------|-------|
| 1 | LOW | Coming-soon panel lacks parchment styling — new CSS classes are unstyled |
| 2 | LOW | HTML-mode BuildingModal shows stale "Coming in Phase 2" copy for placeholder buildings |

## Informational Notes (not bugs)

1. **E2E coverage runs in HTML mode, not Phaser.** `playwright.config.ts` forces `VITE_PHASER_TOWN: 'false'`, so the Playwright suite exercises the HTML `BuildingModal` grid rather than walking Phaser scene transitions. The acceptance-criteria phrasing ("walk from Town Square into each building and back, verify each interior loads") strictly speaking targets the Phaser flow, but the project's established convention (Phase 1 + town-square.spec.ts) is HTML-mode E2E. Unit tests in `all-buildings.test.ts` (47 tests) cover the Phaser-side behavior — sceneKey, return-door config, interactive registration, modal triggers, shutdown cleanup — for all 7 scenes. Adequate for now; Phase 2 capstone (giraffe) is the appropriate place to revisit Phaser-mode E2E.

2. **Coming-soon panel pops up immediately on entry to placeholder scenes.** The scenes call `setActiveModal('coming-soon')` directly in `create()`, so the user sees the unique background art only briefly before the modal mounts over it. The modal-backdrop is `rgba(44, 36, 22, 0.6)`, so the art is partially visible behind. This matches the spec ("render their interior art + a 'Coming in Phase N — <feature>' parchment-style placeholder panel") but is worth keeping an eye on if a future task wants the user to walk around the placeholder interior before triggering the panel (e.g., via a podium interactive instead of auto-show).

3. **Placeholder scene tests share a `for`-loop describe pattern.** Five scenes (Oracle/Library/Tavern/Armory/Hall-of-Returns) share an identical test shape, so `all-buildings.test.ts` loops a `PLACEHOLDER_SCENES` array. Tests are not conditional — each iteration registers six independent `it(...)` blocks via Vitest's standard `describe()` API. No conditional assertions (`if (visible)` style) detected anywhere in the new test or e2e files.

4. **Phase-2 capstone (giraffe) is the next task — not this one.** `specs/phase-02/sequence.md` shows `fox` is the second-to-last task; `giraffe` is the capstone. Capstone coverage check is not mandatory for this review.

## Final Verdict

**FAIL** — 2 LOW bugs filed (review-1, review-2). Both are non-blocking quality issues:
- review-1: missing CSS for `.coming-soon-*` classes (functionality intact, visual differentiation missing)
- review-2: stale HTML-mode placeholder copy ("Coming in Phase 2 — Phaser scene")

Core functionality (scene transitions, HUD overlays, focus management, accessibility, cross-boundary types) is correct. Tests are thorough (184 unit tests, comprehensive E2E for the HTML path including axe-core). No CRITICAL or HIGH issues.

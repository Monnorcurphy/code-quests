# Progress — Phase 2

Previous task progress archived to metrics/progress-before-giraffe.md

## Task giraffe — CAPSTONE: HUD integration + end-to-end walkthrough

**Status:** Complete

**What was done:**
- Created `HUDOverlayManager` component — central manager that reads `town-store.activeModal`, renders correct overlay (TownSquare, WarRoom, GuildHall, ComingSoonPanel), handles focus restoration on close
- Created `SettingsButton` component — gear button (⚙) in top-right; opens settings panel with Reduce Motion toggle; writes to localStorage AND sets `data-reduced-motion` attribute; `applyReducedMotionPreference()` called on startup to restore preference
- Updated `scene-router.ts` — `reducedMotion` getter now checks `data-reduced-motion` attribute first (user setting), then falls back to OS media query
- Updated `town.tsx` — removed `HtmlTown` and `USE_PHASER` flag; Phaser is now the only town; exports `PhaserTown` (named) and default; uses `HUDOverlayManager` + `SettingsButton`
- Updated `app.tsx` — `/town` and `*` both redirect to `/town/town-square`
- Updated `main.tsx` — calls `applyReducedMotionPreference()` before render
- Updated `playwright.config.ts` — removed `VITE_PHASER_TOWN: 'false'` env var
- Updated `phase-1-capstone.spec.ts` — selectors updated for Phaser town (SceneKeyboardNav buttons, `force: true` for visually-hidden elements)
- Updated `all-buildings.spec.ts` — rewritten for Phaser town (URL navigation + SceneKeyboardNav)
- Created `phase-2-capstone.spec.ts` — comprehensive Phase 2 E2E walkthrough test suite
- Created unit tests: `hud-overlay-manager.test.tsx`, `settings-button.test.tsx`
- Rewrote `town.test.tsx` and `app.test.tsx` for Phaser-only mode
- Updated `README.md` — Phase 2 experience, town ASCII map, keyboard nav, settings docs

**Verification:** All 206 unit tests pass, lint clean, typecheck clean, build clean, check:assets passes.

# BUG: HTML-mode BuildingModal shows stale "Coming in Phase 2" copy for placeholder buildings
**Severity:** LOW
**File(s):** packages/client/src/routes/town.tsx

## Problem
In `town.tsx`, the legacy `BuildingModal` (rendered when `VITE_PHASER_TOWN=false`) hardcodes the message:

```tsx
<p className="modal-body">Coming in Phase 2 — Phaser scene</p>
```

(line 56)

This is now misleading on two axes:
1. We *are* in Phase 2 — the Phaser scenes exist (they were just built in this task).
2. Per the spec, each placeholder building has a specific later phase: Oracle/Tavern/Armory → Phase 3, Hall of Returns → Phase 9, Library → Phase 10.

The `PhaserTown` path uses `COMING_SOON_CONTENT` (lines 158–179) which has correct per-building copy ("Refine Acceptance Criteria — arriving in Phase 3.", etc.), but the HTML fallback path falls back to the stale generic string. Since the Playwright E2E suite runs in HTML mode (`VITE_PHASER_TOWN=false`), the misleading copy is exactly what the tests visit.

## Expected
HTML-mode placeholder dialogs should show the same per-building phase reference shown by `ComingSoonPanel` in Phaser mode. A single user-visible message about "what's coming and when" should not have two sources of truth.

## Fix
In `BuildingModal`, look up the per-building copy from the existing `COMING_SOON_CONTENT` map (move the constant above `BuildingModal` so it is in scope, or extract a small helper). For `town-square` / `war-room` / `guild-hall` the modal is never rendered for these in HTML mode, so the map only needs the five placeholders. Suggested change:

```tsx
const content = COMING_SOON_CONTENT[building.id as keyof typeof COMING_SOON_CONTENT];
<p className="modal-body">{content?.description ?? 'Coming soon.'}</p>
```

This keeps a single source of truth for the placeholder copy across HTML and Phaser modes.

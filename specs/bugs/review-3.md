# BUG: HUD overlay text fails WCAG contrast on dark backgrounds (gray-600/-800 on near-black)

**Severity:** HIGH
**File(s):** packages/client/src/features/quest/hud-overlay.tsx

## Problem

`HUDOverlay` paints its top banner and combat-log panel on very dark backgrounds and then writes text in dark grey tones that disappear against them.

Top banner (`hud-overlay.tsx:51`) has `background: 'rgba(30, 20, 10, 0.85)'` (near-black). The `AdventurerName` subcomponent renders text inside that banner with:

- `text-gray-500 italic` for the "No adventurer" placeholder (`hud-overlay.tsx:27`)
- `text-gray-600` for the "Loading…" state (`hud-overlay.tsx:28`)
- `text-gray-800 font-medium` for the resolved adventurer name (`hud-overlay.tsx:29`)

Combat-log panel (`hud-overlay.tsx:130-148`) has `background: 'rgba(20, 12, 5, 0.75)'` (near-black) with the placeholder text styled as `text-gray-600 italic` — virtually invisible on that background.

`text-gray-800` (#1f2937) on `rgba(30,20,10,0.85)` and `text-gray-600` (#4b5563) on `rgba(20,12,5,0.75)` fail WCAG AA (4.5:1) by a wide margin. This is the same family of contrast issue called out in `.claude/rules/accessibility.md` and `.claude/rules/common-findings.md` (Finding #1) — just inverted: when the background is dark, the *dark* grey shades become the failing ones.

The wrapper span at `hud-overlay.tsx:60` also sets `text-gray-300` for the adventurer label, but it's overridden by the inner `AdventurerName` text classes.

## Expected

Per `.claude/rules/accessibility.md`:
> "Contrast ratio: Minimum 4.5:1 for normal text, 3:1 for large text (WCAG AA)."

And the task spec:
> "All text uses ≥ `text-gray-600` (per `.claude/rules/accessibility.md` contrast safelist — no `text-gray-400` family)"

That rule was written assuming light backgrounds. On the dark banner/log backgrounds used here, the SAME rule means text must be light enough to clear 4.5:1 — typically `text-gray-100` or `text-gray-200`. `text-gray-600`/`-700`/`-800` are wrong choices on near-black.

## Fix

In `packages/client/src/features/quest/hud-overlay.tsx`:

1. `AdventurerName` rendering on the dark banner should use light text:
   - "No adventurer" placeholder → `text-gray-300 italic` (or remove the italic if needed)
   - "Loading…" → `text-gray-200`
   - Resolved name → `text-gray-100 font-medium`
2. Combat-log placeholder text → `text-gray-200 italic` (or `text-gray-300` minimum).
3. Verify contrast in a browser (use DevTools' contrast picker) or with axe-core; aim for ≥ 4.5:1.
4. Add a regression check: an axe-core run against the rendered quest route should report zero contrast violations.

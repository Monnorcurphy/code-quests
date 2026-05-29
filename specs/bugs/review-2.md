# BUG: New Phase 9 UI elements have no CSS — scar list and returned-quests badge render unstyled

**Severity:** HIGH
**File(s):** `packages/client/src/features/guild/scar-list.tsx`, `packages/client/src/features/town-square.tsx`, `packages/client/src/styles/features.css`, `assets/CREDITS.md`, `README.md`

## Problem

The two new UI surfaces added by this task reference CSS classes that do not exist anywhere in the project's stylesheets:

- `scar-list.tsx`: `scar-list`, `scar-badge`, `scar-entries`, `scar-entry`, `scar-link`, `scar-date`
- `town-square.tsx` (`ReturnedQuestsBadge`): `returned-quests-badge`, `returned-quests-badge-btn`

Verification:
```
$ grep -c 'scar\|returned-quests-badge' packages/client/src/styles/*.css
features.css:0
global.css:0
```

Both new components render with bare browser-default button styling. Consequences:

1. The README walkthrough explicitly promises a visual outcome that no longer holds — "A red '📜 1 quest returned' badge appears" (README.md, Phase 9 section) — the badge will not be red, will not stand out, and will not look like the demo.
2. `assets/CREDITS.md` was edited to claim "All UI elements (scar badges, recommendation badges, feedback form, action dialogs) are rendered with CSS" — but no CSS for scar badges or the returned-quests badge ships in this PR.
3. The expanded scar list (`<ul class="scar-entries">`) inherits the default `list-style` and will display as a bulleted list jammed against the roster row.

This violates the capstone interactability requirement (`.claude/rules/phase-capstone.md`): "A human must be able to use what the phase built." A badge the user cannot visually distinguish from surrounding text is not a usable badge.

## Expected

Per the spec acceptance criteria (steps 2 and 8) and the README walkthrough this task introduced:

- The returned-quests badge must visibly stand out near the Hall of Returns link (red/parchment colour, distinct typography, sized as a chip).
- The scar badge must render as a small inline badge on the roster row, and the expanded list must be visually grouped, indented under the row, with clearly clickable scar entries.

## Fix

Add the missing rules to `packages/client/src/styles/features.css` (or a colocated stylesheet imported by the feature). At minimum:

```css
.returned-quests-badge { margin: 0.5rem 0; }
.returned-quests-badge-btn {
  background: #b22222; color: #fff; padding: 0.25rem 0.75rem;
  border: none; border-radius: 999px; cursor: pointer;
  font-weight: 600;
}
.returned-quests-badge-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }

.scar-list { display: inline-flex; flex-direction: column; gap: 0.25rem; }
.scar-badge {
  background: #6b2e2e; color: #fde; padding: 0.125rem 0.5rem;
  border-radius: 4px; border: none; cursor: pointer; font-size: 0.85em;
}
.scar-badge:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.scar-entries { list-style: none; padding: 0; margin: 0.25rem 0 0 0.5rem; }
.scar-entry { display: flex; gap: 0.5rem; align-items: baseline; }
.scar-link {
  background: none; border: none; padding: 0; color: var(--link-color, #6cf);
  text-decoration: underline; cursor: pointer; text-align: left;
}
.scar-link:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
.scar-date { font-size: 0.8em; color: var(--text-secondary, #555); }
```

Make sure to:
- Verify text colours meet WCAG AA 4.5:1 contrast on the surrounding background (per `.claude/rules/accessibility.md`).
- Respect `prefers-reduced-motion` on any hover/active transitions.
- Use a colour that is NOT the only indicator (the badge has an emoji prefix already — keep it; for the scar badge the "Scars (N)" text serves the same role).

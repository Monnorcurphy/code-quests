# BUG: Coming-soon panel lacks parchment styling — new CSS classes are unstyled
**Severity:** LOW
**File(s):** packages/client/src/components/coming-soon-panel.tsx, packages/client/src/styles/features.css

## Problem
The new `ComingSoonPanel` renders three element classes that are never defined in any CSS file:
- `.coming-soon-panel` (on the panel container)
- `.coming-soon-description` (on the body paragraph)
- `.coming-soon-note` (on the secondary "fully operational when its phase ships" paragraph)

`grep -rn coming-soon packages/client/src/styles/` returns no matches. The panel still renders because it also uses the shared modal-* classes, but it looks identical to every other modal in the app — there is no parchment-style differentiation.

## Expected
Task spec explicitly requires:
> packages/client/src/components/coming-soon-panel.tsx — reusable **parchment-style** panel: title, body text, "(returns to Town Square)" link; keyboard-dismissable

A parchment aesthetic (warm cream/tan background, serif font, decorative border, etc.) distinguishes the "Coming in Phase N" affordance from functional modals (draft, roster, recruit). Without this styling the only signal that the building is unfinished is the body copy.

## Fix
Add styles for the three classes to `packages/client/src/styles/features.css` (or `global.css`). Suggested rules:
- `.coming-soon-panel`: warm parchment background (e.g., `#f4e8c8`), darker text color, subtle border / box-shadow for the "parchment edge" look.
- `.coming-soon-description`: emphasized phrasing (italic or serif font-family) for the Phase reference.
- `.coming-soon-note`: muted color (≥ `#5c4828` to stay above WCAG 4.5:1 on the parchment background), smaller font-size.

Verify contrast (≥4.5:1) for all text on the new background.

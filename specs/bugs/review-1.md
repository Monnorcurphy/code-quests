# BUG: AutoMatchPreview classes have no CSS — error and loading states render as plain text

**Severity:** LOW
**File(s):** packages/client/src/features/quests/auto-match-preview.tsx, packages/client/src/styles/features.css

## Problem
`auto-match-preview.tsx` references CSS classes that have no definitions in `packages/client/src/styles/features.css`:

- `.auto-match-preview` (section wrapper) — no margin/padding/border
- `.auto-match-heading` (h4) — no styling
- `.auto-match-suggestion` (p) — no styling
- `.auto-match-label`, `.auto-match-name`, `.auto-match-reason` (spans) — no emphasis
- `.auto-match-loading` (loading text) — no spinner/animation
- `.auto-match-error` (error text) — no red color/background/border
- `.auto-match-unavailable`, `.auto-match-no-adventurers`, `.auto-match-hint`, `.auto-match-override` — no styling

Other components in the codebase ship matching CSS (e.g., `.dispatch-error` defined in `features.css:1131` with red background and color; `.spec-audit-error` at `features.css:1013`). The new component breaks this pattern.

Concrete consequence: when the auto-match request fails the error paragraph displays as ordinary body text — visually indistinguishable from the surrounding suggestion text — even though it is the only signal to the user that the suggestion failed.

## Expected
Per `.claude/rules/ux-feedback.md` ("Every async action button MUST have three states: loading […], success confirmation, and error feedback") and `.claude/rules/ux-design.md` ("What just happened? Every user action must produce visible feedback"), the error, loading, and suggestion states need a visual treatment that is consistent with the other surfaces in the War Room (dispatch-success, dispatch-error, spec-audit-error, etc.).

## Fix
Add CSS for the `.auto-match-*` classes in `packages/client/src/styles/features.css`. At minimum:

- `.auto-match-preview` — top/bottom margin (e.g., `margin: 0.75rem 0;`) and a subtle border or background block so it reads as its own section.
- `.auto-match-heading` — heading weight matching other panel headings (see `.dispatch-section`, `.spec-audit-heading`).
- `.auto-match-suggestion` — emphasize the suggested name (bold) and de-emphasize the reason (lighter weight or muted color, still meeting WCAG 4.5:1 — use `text-gray-600` or darker, not `-400`).
- `.auto-match-error` — same shape as `.dispatch-error` (red background `#fce4ec`, border, padding, role="alert" already on the element).
- `.auto-match-loading` — same shape as `.dispatch-success`/`.spec-audit-loading` or whatever loading style the rest of the app uses.
- `.auto-match-no-adventurers`, `.auto-match-unavailable` — muted but readable color (>=`#666` on white).
- `.auto-match-hint` — small, muted descriptive text style.

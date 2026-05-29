# BUG: New repost-skill-* and bestiary-type-filter-banner classes have no CSS — Skills picker and filter banner render unstyled

**Severity:** LOW
**File(s):** packages/client/src/features/hall-of-returns/actions/repost-dialog.tsx, packages/client/src/features/library/bestiary.tsx, packages/client/src/styles/features.css

## Problem
The cancer task introduces six new class names that the visual design depends on, but no CSS rules were added for any of them. Grep across the whole client package finds zero matches in any stylesheet:

- `repost-skills-empty` — empty-state message in the Skills fieldset (`repost-dialog.tsx:212`)
- `repost-skills-list` — `<ul>` of available skills (`repost-dialog.tsx:214`)
- `repost-skill-row` — each `<li>` skill row (`repost-dialog.tsx:216`)
- `repost-skill-label` — `<label>` wrapping the checkbox + name (`repost-dialog.tsx:217`)
- `repost-skill-name` — `<span>` for the skill name (`repost-dialog.tsx:224`)
- `bestiary-type-filter-banner` — "Filtered by type: X" banner above the bestiary table (`bestiary.tsx:192`)

Concrete consequence: the Skills (Equipment) section in the re-post dialog renders as a default browser bullet list jammed against the previous fieldset with no padding, spacing, or visual treatment; the filter banner is plain body text indistinguishable from list rows. Existing dialog sections (`.ac-list`, `.ac-row`, `.ac-input`, etc.) and other Library banners are styled, so the new section is visibly inconsistent with the rest of the panel.

This is the same pattern as `review-1` from task aries (auto-match-preview) — new components shipped without the matching CSS rules.

## Expected
Per `.claude/rules/ux-design.md` ("Every screen … must answer 'What just happened?'") and the visual consistency standard set by the existing `.ac-list`/`.ac-row` styles in `features.css`, the new fieldset and banner need styling that matches the surrounding dialog/library surfaces.

## Fix
Add CSS rules to `packages/client/src/styles/features.css`:

- `.repost-skills-list` — no list bullets (`list-style: none`), zero default padding, vertical gap between rows.
- `.repost-skill-row` — vertical padding (`0.35rem 0`), optional bottom border to separate rows.
- `.repost-skill-label` — `display: flex`, `align-items: center`, `gap: 0.5rem`, `cursor: pointer`.
- `.repost-skill-name` — body weight, ensure contrast on the dialog background (use a color ≥ `#333` / `text-gray-700` equivalent).
- `.repost-skills-empty` — muted but WCAG-compliant secondary text (≥ `text-gray-600`), italic optional, top/bottom margin.
- `.bestiary-type-filter-banner` — distinct background block (e.g., subtle yellow/blue tint), padding `0.5rem 0.75rem`, border-radius, bottom margin before the table.

Verify the classes render with visible styling in the running app, not just that the markup contains them.

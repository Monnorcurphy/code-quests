# BUG: Hall of Returns new components have no CSS — tabs, rows, badges, and skeleton placeholders are unstyled

**Severity:** HIGH
**File(s):**
- `packages/client/src/styles/features.css`
- `packages/client/src/features/hall-of-returns/hall-of-returns.tsx`
- `packages/client/src/features/hall-of-returns/returned-quest-list.tsx`

## Problem

The TASK cedar implementation replaced the previous Hall of Returns UI (two-column return-card grid) with a tabbed list view that uses an entirely new set of CSS class names:

- Tabs: `hall-tabs`, `hall-tab`, `hall-tab--active`
- List container & rows: `hall-list`, `hall-list-row`, `hall-list-row--skeleton`
- Columns: `hall-list-col`, `hall-list-col--title`, `hall-list-col--adventurer`, `hall-list-col--monster`, `hall-list-col--time`, `hall-list-col--badge`
- Skeleton sub-parts: `hall-list-skeleton-title`, `hall-list-skeleton-meta`, `hall-list-skeleton-badge`
- Recommendation badges: `hall-rec-badge`, `hall-rec-badge--repost_with_clarification`, `hall-rec-badge--retire`, etc.
- Adventurer / monster sub-elements: `hall-list-adventurer-name`, `hall-list-adventurer-class`, `hall-list-adventurer-sep`, `hall-list-no-adventurer`, `hall-list-monster-sprite`, `hall-list-monster-name`, `hall-list-no-monster`
- Empty / error state: `hall-list-empty`, `hall-list-error`, `hall-list-error-msg`

None of these class names have any CSS rules defined anywhere in `packages/client/src/styles/` (verified with `grep -rn "hall-list\|hall-tab\|hall-rec" packages/client/src/styles/` — zero matches). Meanwhile, `features.css` still contains ~150 lines of CSS for the old, now-deleted `return-card` / `return-column` / `.hall-of-returns-columns` UI.

User-visible consequences:

1. **Loading state is invisible.** `SkeletonRow` renders three `<span>` placeholders with no content and no CSS — they collapse to zero width/height. The spec acceptance criterion "Loading state: skeleton rows (3 placeholders)" is not met visibly. Tests pass because they only assert the elements exist in the DOM.
2. **Active tab indicator is missing.** Both tabs render as identical default `<button>` elements; the user can't see which tab is active without inspecting `aria-selected`. This violates the spec ("Two tabs: Returned (default)") because the user has no visual way to tell them apart.
3. **Recommendation badge looks like plain text.** No background, no border, no color — the `hall-rec-badge--*` modifier is supposed to convey severity / outcome at a glance.
4. **Row layout is broken.** Title, adventurer, monster, time, and badge `<span>`s have no grid/flex container styling, so they wrap in arbitrary ways.
5. **Empty / error states have no styling** for spacing, alignment, or contrast.

## Expected

Per the task spec (`metrics/task-cedar-context.md`):
- "Loading state: skeleton rows (3 placeholders); error state: persistent banner with retry button"
- "All text ≥ 4.5:1 contrast"
- "Axe-core scan: zero violations on the list view"

Per `.claude/rules/ux-feedback.md`:
- Every async action button MUST have visible loading and error feedback.
- Loading announcements must be visible, not only announced to screen readers.

The new components require real CSS — at minimum: tab styling with active state, list row grid layout, skeleton dimensions / shimmer, recommendation badge appearance, empty/error state spacing and contrast-safe colors.

## Fix

1. In `packages/client/src/styles/features.css`, add CSS for the new component classes. Specifically:
   - `.hall-tabs` (flex row), `.hall-tab` (button reset + padding + border-bottom), `.hall-tab--active` (visible active indicator: weight, color, or border).
   - `.hall-list` (ul reset, gap), `.hall-list-row` (button reset, grid columns, padding, border).
   - `.hall-list-row--skeleton` and the three skeleton sub-classes — give them explicit width/height so the loading state is actually visible, plus a `prefers-reduced-motion`-aware shimmer or pulse.
   - `.hall-rec-badge` and per-recommendation modifiers — pick contrast-safe palette consistent with the existing `--color-*` variables.
   - `.hall-list-empty`, `.hall-list-error`, `.hall-list-error-msg` — spacing, alignment, and color matching the rest of the modal.
   - `.hall-list-monster-sprite` (vertical alignment with text).
   - `:focus-visible` outline on `.hall-list-row` and `.hall-tab` to satisfy `rules/accessibility.md` rule 2 ("Focus visible").
2. Delete the now-unused CSS for the old implementation: `.return-card*`, `.return-column*`, `.hall-of-returns-columns`, and the related `@media (prefers-reduced-motion)` / `[data-reduced-motion]` rules that target `.return-card`. Verify with `grep -rn "return-card\|return-column" packages/client/src/` — they should appear only in tests / removed files, no current TSX uses them.
3. Manually open the Hall of Returns in the dev server, confirm the active tab is visually distinct, the three skeleton rows are visible while loading, and the recommendation badge renders as a styled pill.

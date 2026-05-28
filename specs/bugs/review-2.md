# BUG: Bestiary scope tabs + promote modal use undefined CSS classes — active state invisible to sighted users

**Severity:** HIGH
**File(s):**
- packages/client/src/features/library/bestiary.tsx
- packages/client/src/features/library/monster-detail.tsx
- packages/client/src/features/library.tsx
- packages/client/src/features/town-square.tsx
- packages/client/src/styles/features.css (missing rules)

## Problem

The capstone introduces several new UI elements that reference CSS classes that are
not defined anywhere in `packages/client/src/styles/`. Grepping `src/styles` for
each of the new class names returns zero matches (only `bestiary-empty-hint` already
existed and is re-used correctly).

Undefined new classes referenced by the capstone code:

| Class | Used in | Purpose |
|---|---|---|
| `library-header` | `library.tsx:35` | wraps title + badge |
| `library-bestiary-badge` | `library.tsx:38` | "Bestiary unlocked — N monsters logged" badge |
| `bestiary-scope-tabs` | `bestiary.tsx:185` | tablist wrapper |
| `bestiary-scope-tab` | `bestiary.tsx:191, 200` | individual tab buttons |
| `bestiary-scope-tab--active` | `bestiary.tsx:191, 200` | **active-state modifier** |
| `nemesis-badge` | `monster-detail.tsx:179` | ⚔ Nemesis badge after promotion |
| `monster-detail-actions` | `monster-detail.tsx:234` | container around Mark-as-Nemesis button |
| `promote-modal` | `monster-detail.tsx:85` | modal panel modifier |
| `promote-success` | `monster-detail.tsx:184` | success toast |
| `promote-form` | `monster-detail.tsx:92` | form wrapper |
| `town-square-library-preview` | `town-square.tsx:21` | sidebar Library card |
| `town-square-library-label` | `town-square.tsx:22` | sidebar Library label |
| `town-square-library-btn` | `town-square.tsx:29` | "Open Library" button |

The most user-impacting failure is `bestiary-scope-tab--active`: with no CSS rule
attached, the two scope tabs ("Mine (Project)" and "Nemeses (Guild)") render with
identical styling regardless of which one is selected. Sighted users have **no
visual indicator** that one tab is active — they cannot see focus state, selected
state, or hover state.

This violates two rules:
1. `.claude/rules/accessibility.md` #2 ("Focus visible — All focusable elements must
   have a visible focus indicator") and #3 ("Color is not the only indicator" — here
   there is **no** indicator at all).
2. `.claude/rules/ux-design.md` "Question #1 — Where am I?" ("Active nav item
   highlighted").

The capstone is supposed to be human-interactable (rule #13 of the constitution).
Active-tab invisibility undermines that — the user reads the Bestiary content and
has to infer which scope they're looking at from the rows alone.

Why tests passed:
- Vitest jest-axe and Playwright axe-core verify ARIA attributes only. They do not
  measure CSS or visual styling.
- The E2E test asserts `aria-selected="true"` is set on the active tab, which is
  correct in code — but the user cannot see that.

## Expected

Per `.claude/rules/accessibility.md` #2/#3 and `.claude/rules/ux-design.md`:

- Active tabs are visually distinguishable from inactive tabs (background, border,
  underline, or text-weight change — not color alone).
- Focus indicators are visible on the tab buttons and on form inputs in the
  promote modal.
- The new badges, modal panels, and Town Square Library preview have minimal
  styling consistent with the existing modal/badge patterns elsewhere in
  `features.css` (e.g., `nemesis-badge` should look like a chip; `library-bestiary-badge`
  should match the existing `returned-quests-badge` styling tier).

## Fix

In `packages/client/src/styles/features.css`, add rules for every new class listed
above. At minimum:

```css
.bestiary-scope-tabs { display: flex; gap: 0.25rem; margin-bottom: 0.75rem; }
.bestiary-scope-tab {
  background: transparent;
  border: 1px solid var(--color-stone-border);
  padding: 0.4rem 0.9rem;
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  color: var(--color-text-secondary);
  cursor: pointer;
}
.bestiary-scope-tab:focus-visible { outline: 2px solid var(--color-accent); }
.bestiary-scope-tab--active {
  background: var(--color-surface);
  color: var(--color-text);
  font-weight: 600;
  border-bottom: 2px solid var(--color-accent);
}

.library-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.library-bestiary-badge {
  background: var(--color-accent-soft, #fde68a);
  color: var(--color-text);
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.8rem;
}

.nemesis-badge {
  background: #4c1d95;
  color: #fff;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  margin-left: 0.5rem;
}

.promote-success {
  background: #d1fae5;
  color: #065f46;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  margin: 0.5rem 0;
}

/* …and similar minimal rules for the rest. */
```

Verify in the dev server:
1. Open Library → see the badge in the header.
2. Open Bestiary → click between scope tabs; the active one is visually distinct.
3. Click a monster → click "Mark as Nemesis" → the modal panel has the same
   chrome as `RecruitModal` / `WarRoom`, not unstyled defaults.
4. After promotion → ⚔ Nemesis badge is clearly a chip, not raw text.

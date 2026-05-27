# BUG: Quest card `<button>` contains block-level descendants (`<div>`, `<p>`, `<ul>`)

**Severity:** LOW
**File(s):** `packages/client/src/features/hall-of-returns.tsx`

## Problem

`QuestCard` renders the entire card as a single `<button>` containing block content:

```tsx
<button className="return-card ..." aria-label="...">
  <div className="return-card-header">…</div>
  <p className="return-card-adventurer">…</p>
  <ul className="return-card-log" aria-label="Last log entries">
    <li>…</li>
  </ul>
  <p className="return-card-failure-rec">…</p>
</button>
```

The HTML spec only allows phrasing content inside `<button>`. `<div>`, `<p>`, and `<ul>`/`<li>` are flow content, not phrasing content. Consequences:

- The HTML is invalid; some browsers will hoist children out of the button at parse time.
- The `<ul role="list">` semantics inside the button are typically suppressed by screen readers — the `aria-label="Last log entries"` on the inner list is unreachable when the parent is a button (the button announces itself as a single control with one accessible name).
- Future axe-core rule updates or stricter linters will flag this.

## Expected

Per HTML5 spec and `.claude/rules/accessibility.md` rule 6 ("Semantic HTML"): use elements correctly. A list of last log entries inside a button has no list semantics for assistive tech.

## Fix

Restructure the card so the click target is a button but the list and paragraphs are sibling/child of a non-interactive container. Two acceptable approaches:

**A. Stretched-link pattern.** Use an `<article>` (or `<div>`) as the card and place a visually hidden `<button>` that overlays it (or a single small "View details" button at the bottom). This keeps list/paragraph semantics intact.

**B. Phrasing-only button content.** Keep the `<button>` but replace `<div>`, `<p>`, `<ul>` with `<span>` and visually format with CSS `display: block`. The "log entries" become a comma-separated span; if you want list semantics, move the list outside the button.

Either way, the button must contain only phrasing content. Update the unit tests so they continue to find the card by accessible name.

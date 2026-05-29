# BUG: Test assertions use toBeDefined on querySelector / getElementById — pass even when element is missing

**Severity:** LOW
**File(s):**
- `packages/client/src/__tests__/hall-of-returns.test.tsx`
- `packages/client/src/features/hall-of-returns/__tests__/returned-quest-list.test.tsx`

## Problem

Several tests assert presence of DOM elements with `expect(node).toBeDefined()` where `node` is the result of `document.querySelector(...)` or `document.getElementById(...)`. Both DOM APIs return `Element | null` — never `undefined`. `toBeDefined()` only fails on the literal value `undefined`, so the assertion is satisfied even when the element is missing (returns `null`).

Examples:

`packages/client/src/__tests__/hall-of-returns.test.tsx`:
```tsx
it('shows loading state while fetching', () => {
  mockListQuests.mockImplementation(() => new Promise(() => {}));
  renderPanel();
  const list = document.querySelector('[aria-busy="true"]');
  expect(list).toBeDefined();           // passes even if list === null
});

it('tabpanels exist in DOM for screen readers', async () => {
  renderPanel();
  await screen.findByRole('dialog');
  expect(document.getElementById('hall-panel-returned')).toBeDefined();   // passes if null
  expect(document.getElementById('hall-panel-completed')).toBeDefined();  // passes if null
});
```

`packages/client/src/features/hall-of-returns/__tests__/returned-quest-list.test.tsx`:
```tsx
it('shows relative time for each row', async () => {
  ...
  const timeEl = document.querySelector('time');
  expect(timeEl).toBeDefined();   // passes if no <time> element rendered
});
```

This is the same anti-pattern that `.claude/rules/common-findings.md` § "Conditional test assertions" warns against: the test silently validates nothing. If the loading UL, the `<time>` element, or the tabpanel divs were accidentally removed, these tests would still pass.

## Expected

Per `.claude/rules/testing.md` and `.claude/rules/common-findings.md` (#9), test assertions must fail when the thing under test is missing. For nullable lookups use `not.toBeNull()`, `toBeTruthy()`, or — preferably — `screen.getBy*` queries which throw when the element isn't present.

## Fix

1. Replace each `expect(document.querySelector(...)).toBeDefined()` and `expect(document.getElementById(...)).toBeDefined()` with either:
   - `expect(node).not.toBeNull()`, or
   - a Testing Library query (e.g., `screen.getByRole('list', { name: /loading quests/i })`, `within(panel).getByRole(...)`, etc.), which throws if absent.
2. For the loading-state test in `hall-of-returns.test.tsx`, use the same accessible name (`aria-label="Loading quests"`) that the implementation sets — e.g. `expect(screen.getByRole('list', { name: /loading quests/i }).getAttribute('aria-busy')).toBe('true')`.
3. For the `'tabpanels exist in DOM'` test, assert the elements via `screen.getByRole('tabpanel', { hidden: true })` (since the hidden panel still has the role) or `not.toBeNull()`.

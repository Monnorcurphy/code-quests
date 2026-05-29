# BUG: QuestRow onKeyDown handler double-fires navigation on Enter

**Severity:** LOW
**File(s):**
- `packages/client/src/features/hall-of-returns/returned-quest-list.tsx`

## Problem

`QuestRow` renders the row as a native `<button>`, which already invokes its `onClick` handler when Enter is pressed while focused. The component additionally attaches a custom `onKeyDown` handler that calls `onClick(quest.id)` on Enter:

```tsx
<button
  className="hall-list-row"
  onClick={() => onClick(quest.id)}
  onKeyDown={(e) => {
    if (e.key === 'Enter') onClick(quest.id);
  }}
  aria-label={`${quest.title} — view post-mortem`}
>
```

When the user presses Enter on a focused row, the browser fires:
1. `keydown` → custom handler runs → `onClick(quest.id)` → `navigate('/hall-of-returns/quest-1')`
2. Native `click` → React `onClick` runs → `navigate('/hall-of-returns/quest-1')`

The result is `navigate` invoked twice with the same target. The test `'pressing Enter on a row navigates to /hall-of-returns/:questId'` only uses `toHaveBeenCalledWith` (no call-count assertion), so the bug is hidden by the existing tests.

Functionally the duplicate `navigate` is idempotent (same URL), but the double-handling is dead code and a code smell that will surface as a real bug once the target is non-idempotent (e.g., `navigate(..., { replace: false })`, mutation, analytics ping).

## Expected

- A native `<button>` already handles Enter/Space → click. Per `.claude/rules/accessibility.md` rule 1 ("Keyboard accessible"), Enter on a button must fire the action once — not twice.
- Tests for keyboard interaction should assert call count, not just call arguments.

## Fix

1. Remove the `onKeyDown` handler from the `<button>` in `QuestRow` — Enter and Space are handled natively.
2. In `packages/client/src/features/hall-of-returns/__tests__/returned-quest-list.test.tsx`, tighten the Enter-key test to assert `expect(navigateMock).toHaveBeenCalledTimes(1)` after the keypress.

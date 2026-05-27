# BUG: Two "dispatch" buttons render simultaneously when block gaps are shown

**Severity:** LOW
**File(s):** packages/client/src/features/quests/dispatch-button.tsx

## Problem

When a dispatch attempt returns a 409 with block gaps, the component renders:

- The "Dispatch anyway" panel inside `{blockAudit && !showBypassConfirm && (...)}` (lines 115–136), AND
- The main "Dispatch quest" button inside `{!showBypassConfirm && !success && (...)}` (lines 178–188).

Both are visible to the user at the same time. The "Dispatch quest" button calls `handleDispatch()`, which clears `blockAudit` and re-issues `mutate(false)` — the same flow the user just triggered, which the server will reject for the same reasons.

For a sighted user this looks like two side-by-side affordances with no clear distinction between them. For a screen-reader user it reads as two consecutive "dispatch" actions with no indication that one is a bypass path and the other is a retry. This violates the "What do I do next?" principle in `rules/domain/frontend/ux-design.md`: the user should be guided to one clear next step.

## Expected

When `blockAudit` is set (i.e., there are unresolved block gaps), the primary "Dispatch quest" button should be hidden — the only forward affordances should be:
- "Dispatch anyway" (escape hatch with countdown), and
- The Go-to-Building chips in the audit, which fix the underlying problem.

## Fix

Update the render guard for the primary dispatch button so it also hides when `blockAudit` is non-null:

```tsx
{!showBypassConfirm && !success && !blockAudit && (
  <button … onClick={handleDispatch} …>{isPending ? 'Dispatching…' : 'Dispatch quest'}</button>
)}
```

Add a test asserting that the "Dispatch quest" button is not in the DOM once the 409 audit has been rendered.

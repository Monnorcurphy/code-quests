# BUG: PausedInputModal body uses contradictory role="status" + aria-live="assertive"

**Severity:** LOW
**File(s):** packages/client/src/features/quest/paused-input-modal.tsx

## Problem

The body paragraph that contains the quest question is marked with both `role="status"` AND `aria-live="assertive"`:

```tsx
<p
  id="paused-input-body"
  role="status"
  aria-live="assertive"
  aria-atomic="true"
  ...
>
  {bodyText}
</p>
```

The `role="status"` ARIA role has an implicit `aria-live="polite"`. While the WAI-ARIA spec allows the explicit `aria-live` attribute to override the implicit politeness setting, mixing the two is contradictory and known to produce inconsistent behavior across screen readers (NVDA vs JAWS vs VoiceOver). Some implementations honor the role's implicit politeness; others honor the explicit attribute; behavior may even differ by version.

The task spec explicitly requires assertive announcement so the screen reader interrupts and announces the question immediately.

## Expected

Per `.claude/rules/accessibility.md` (ARIA supplements, not replaces, semantic HTML) and the task spec ("aria-live='assertive' on the body so screen readers announce the question"), the body should use either:

- `role="alert"` (which has an implicit `aria-live="assertive"`) and drop the explicit aria-live, OR
- Drop `role="status"` entirely and keep `aria-live="assertive"` on a plain element.

The semantically clearest choice for "an interruption requiring user attention" is `role="alert"`.

## Fix

Change the body element in `paused-input-modal.tsx`:

```tsx
<p
  id="paused-input-body"
  role="alert"
  aria-atomic="true"
  style={{ ... }}
>
  {bodyText}
</p>
```

Update the matching test in `paused-input-modal.test.tsx` from:

```ts
const body = screen.getByRole('status');
expect(body.getAttribute('aria-live')).toBe('assertive');
```

to:

```ts
const body = screen.getByRole('alert');
expect(body.textContent).toContain(SAMPLE_REQUEST.question);
```

The `UserBlockedModal` body (which uses `role="status"` + `aria-live="polite"`) is consistent and does not need changing.

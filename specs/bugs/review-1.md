# BUG: Missing axe-core a11y test for the Coin Monster Type modal

**Severity:** HIGH
**File(s):** `packages/client/src/features/library/__tests__/coin-monster-type-modal.test.tsx`

## Problem

The task spec for `ganges` lists "Zero axe-core violations" as an explicit
acceptance criterion. The new test file (22 tests) covers submit-disabled
state, regex validation, keyboard nav, 409 errors, the happy path, and
dismiss — but it does NOT run axe-core against the rendered modal.

Sibling components in the same package (e.g.
`bestiary.test.tsx` lines 312–328) already use `vitest-axe`'s `axe()` and
`toHaveNoViolations()`. The pattern is established in this codebase; the new
modal simply omits it.

Because the existing bestiary axe tests render Bestiary in its DEFAULT state
(modal closed), no axe pass currently exercises the new modal's markup at
all — neither the new test file nor any other.

## Expected

Per the task spec acceptance criteria and `rules/accessibility.md` ("Zero
violations" — axe-core in tests), a Vitest assertion using `axe()` +
`toHaveNoViolations()` must exercise the open modal. At minimum it should
cover the initial state. Ideally it would also cover an error state (e.g.
after an invalid-regex inline error renders) to verify the `aria-describedby`
wiring is correct.

## Fix

Add an `accessibility` describe block at the end of
`packages/client/src/features/library/__tests__/coin-monster-type-modal.test.tsx`,
following the bestiary pattern:

```ts
import { axe } from 'vitest-axe';
// existing imports...

describe('CoinMonsterTypeModal — accessibility', () => {
  it('has no axe violations in initial state', async () => {
    const { container } = renderModal();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations when an inline regex error is shown', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    const { container } = renderModal();
    await user.type(screen.getByLabelText(/failure signature/i), '***');
    await waitFor(() => screen.getByText(/must be a valid regular expression/i));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

Both tests must pass with zero violations.

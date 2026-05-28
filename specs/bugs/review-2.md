# BUG: Weak assertion — `queryByRole(...).toBeDefined()` always passes
**Severity:** LOW
**File(s):** `packages/client/src/features/quest/__tests__/hud-overlay-encounter.test.tsx`

## Problem
The test on line 91–94:

```ts
it('renders no encounter info when no encounter is active', () => {
  renderHUD('q-1');
  expect(screen.queryByRole('region', { name: /active encounter/i })).toBeDefined();
  expect(screen.queryByText('Goblin')).toBeNull();
});
```

`queryByRole` returns `HTMLElement | null`. `.toBeDefined()` only fails when the value is `undefined`, so it passes for both a real element AND `null`. The assertion silently validates nothing about the region's presence — if the wrapper region were removed entirely, this test would still pass.

This is exactly the kind of "test that passes without asserting" called out in `rules/common-findings.md` (#9 Conditional test assertions) and `rules/testing.md` ("Never wrap assertions in `if (element.isVisible())` ... the test passes but validates nothing").

## Expected
Assertions about element presence must use a tool that actually fails on absence:

- `expect(screen.getByRole(...))` — throws if missing
- `expect(screen.queryByRole(...)).not.toBeNull()` — explicit non-null

## Fix
Replace the assertion with one of:

```ts
expect(screen.getByRole('region', { name: /active encounter/i })).toBeInTheDocument();
// or
expect(screen.queryByRole('region', { name: /active encounter/i })).not.toBeNull();
```

While there, collapse the duplicated import at the top of the file:

```ts
import type { Quest } from '@code-quests/shared';
import type { AgentEvent } from '@code-quests/shared';
```

into a single line:

```ts
import type { Quest, AgentEvent } from '@code-quests/shared';
```

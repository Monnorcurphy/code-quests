# BUG: Lich aggregator test name contradicts its assertion

**Severity:** LOW
**File(s):** packages/server/src/__tests__/quest-runner.test.ts

## Problem

In `quest-runner.test.ts` at line 831, the test description says the runner does NOT
spawn a second lich, but the assertion expects exactly 2 liches:

```ts
it('does not spawn a second lich for a second distinct type hitting the threshold', async () => {
    ...
    // Each distinct type hitting threshold spawns one lich
    expect(lichAppearedEvents.length).toBe(2);
});
```

The actual behaviour being verified is "one lich per distinct type that hits the
threshold" (the inline comment makes that clear). The test name says the opposite,
which will confuse anyone debugging a future change here.

## Expected

Test names should describe the asserted behaviour so a failing test in CI gives an
accurate hint about what regressed.

## Fix

Rename the test to match the assertion:

```ts
it(`spawns one lich per distinct type that hits ${LICH_REPEAT_THRESHOLD} encounters`, async () => {
  // ...same body
});
```

No code change required — only the test description.

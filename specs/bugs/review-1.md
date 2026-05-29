# BUG: Misleading test name for `buildFailureSummary` zero-input case

**Severity:** LOW
**File(s):** `packages/server/src/lib/__tests__/failure-summary.test.ts`

## Problem

In the `describe('recommendation: retire')` block, the test on lines 193–195 is named:

```
it('returns retire when no agents and no encounters', () => {
  expect(buildFailureSummary(makeQuest(), [], []).recommendation).toBe('repost_with_clarification');
});
```

The test name asserts the recommendation is `retire`, but the actual assertion expects `repost_with_clarification`. The implementation falls through to the `retries <= 1 && defeats <= 1` branch (since `retries = 0` and `defeats = 0`), which correctly yields `repost_with_clarification`.

This is a test-hygiene issue: a future reader will be confused about what the code actually does, and the misplaced test under the wrong `describe('recommendation: retire')` group is also misleading.

## Expected

Per `rules/testing.md` and general test-clarity expectations, test names must accurately describe the asserted behavior. Either the name (and parent `describe`) or the assertion is wrong; one of them needs to change so they agree.

## Fix

Either:

1. Move the test out of `describe('recommendation: retire')` and rename it to `'returns repost_with_clarification when no agents and no encounters'`. Place it inside the `describe('recommendation: repost_with_clarification')` block. This matches the current implementation behavior.

OR

2. If the intended behavior really is `retire` for the zero-input edge case (no attempts, no encounters), update `chooseRecommendation` so `retries === 0 && defeats === 0` returns `'retire'` (e.g., add a guard before the `retries <= 1` check). Then keep the assertion + name in `recommendation: retire`. Note the spec's "Otherwise → retire" suggests the latter interpretation is more aligned with intent — a quest with zero attempts is not a spec-clarity problem, so `repost_with_clarification` is arguably wrong.

Option 2 is the more spec-aligned fix; pick it unless there is a reason to keep `repost_with_clarification` for the no-input edge case.

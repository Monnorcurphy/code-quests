# BUG: Dead variable `markedAt` in full-cycle test
**Severity:** LOW
**File(s):** packages/server/src/__tests__/quests-pause-block.test.ts

## Problem

In the test `full block → unblock cycle: quest completes after unblock respawns the agent`
(line 495), the test declares:

```ts
const markedAt = new Date().toISOString();
```

at line 498, never uses it (the test goes through the real `/block` and `/unblock`
HTTP routes, which generate their own timestamps), and silences the linter at
line 541 with:

```ts
void markedAt; // suppress unused warning
```

This is dead code with a band-aid suppression comment. `void`-ing an unused local
variable is exactly the pattern `code-quality.md` calls out under "Dead code"
("No commented-out code... No unused imports, variables, or functions").

## Expected

Per `.claude/rules/code-quality.md`:

> No unused imports, variables, or functions — run your linter

Either the variable is actually needed (then use it) or it should be deleted
along with the `void markedAt;` workaround.

## Fix

In `packages/server/src/__tests__/quests-pause-block.test.ts`:

- Delete line 498 (`const markedAt = new Date().toISOString();`)
- Delete line 541 (`void markedAt; // suppress unused warning`)

Re-run `pnpm --filter @code-quests/server lint` and the relevant test file to
confirm no regressions.

# BUG: Phase 5 E2E global-setup command silently fails — seed never runs

**Severity:** CRITICAL
**File(s):** packages/client/tests/e2e/global-setup.ts

## Problem

The Playwright global-setup invokes the seed script with:

```ts
execSync('pnpm --filter=@code-quests/server tsx src/scripts/seed-dev.ts', { stdio: 'inherit' });
```

`tsx` is not defined as a script in `packages/server/package.json` — it is a devDependency binary. When pnpm with `--filter=<pkg>` is asked to run an undefined script name, it prints:

```
None of the selected packages has a "tsx" script
```

and **exits with code 0**. `execSync` does not throw, so global-setup completes silently without ever running `seed-dev.ts`. Reproduced from the repo root:

```
$ pnpm --filter=@code-quests/server tsx src/scripts/seed-dev.ts; echo "exit: $?"
None of the selected packages has a "tsx" script
exit: 0
```

Because the seed never runs, the `Phase 5 Demo: Cave Expedition` quest is never created in the DB. Every one of the 6 tests in `packages/client/tests/e2e/phase-5-capstone.spec.ts` then fails:

- 4 tests time out waiting for the Party Map / Scene Nav (no active quests → UI doesn't render the Party Map)
- 2 tests crash with `TypeError: activeQuests.find is not a function` because `/quests/active` returns a non-array response when no demo quest exists

The builder's own log notes: *"the E2E suite covers the full walkthrough plus a11y scans, but requires both dev servers running to execute"* — i.e. it was never actually run during verification.

## Expected

- The capstone E2E suite must run green per the task spec: *"Playwright E2E test runs all of the above headlessly and passes."*
- Acceptance criterion #7 (in `metrics/task-greatsword-context.md`) requires the test to pass.
- `.claude/rules/phase-capstone.md` requires the phase to be interactable and verified by the included E2E.

## Fix

Either:

1. Use `pnpm exec` so pnpm runs the binary instead of looking for a script:
   ```ts
   execSync('pnpm --filter=@code-quests/server exec tsx src/scripts/seed-dev.ts', { stdio: 'inherit' });
   ```
2. Or add a `"seed": "tsx src/scripts/seed-dev.ts"` script in `packages/server/package.json` and call:
   ```ts
   execSync('pnpm --filter=@code-quests/server seed', { stdio: 'inherit' });
   ```

After the fix, run `pnpm exec playwright test packages/client/tests/e2e/phase-5-capstone.spec.ts` from a clean DB and confirm all 6 tests pass.

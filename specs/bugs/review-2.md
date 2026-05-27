# BUG: Playwright tests depend on manually-run seed; spec acceptance requires `pnpm install && pnpm dev` self-bootstraps

**Severity:** HIGH
**File(s):** packages/client/tests/e2e/phase-4-capstone.spec.ts, README.md, packages/server/src/scripts/seed-dev.ts, playwright.config.ts

## Problem

The capstone spec (acceptance criterion #1) requires:

> `pnpm install && pnpm dev` boots both server and client; seed runs idempotently; **no `ANTHROPIC_API_KEY` required for the demo**.

But neither `pnpm dev` nor `pnpm test:e2e` runs the seed. The seed is documented in README.md as `(Optional)`, and there is no `globalSetup` in `playwright.config.ts` that runs it before E2E. The shared dev database lives at `~/.code-quests/db.sqlite`, so once a developer manually seeds, every subsequent run "works." On a fresh checkout, the following test fails because the only quest it identifies by literal title does not exist:

```ts
// phase-4-capstone.spec.ts:218
test('pre-seeded completed quest is visible in Hall of Returns', async ({ page }) => {
  await page.goto('/town/hall-of-returns');
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Banish the Memory Leak')).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('Victory').first()).toBeVisible();
});
```

The "Banish the Memory Leak" row only exists after `pnpm --filter=@code-quests/server tsx src/scripts/seed-dev.ts` has been run. The "returned-quest detail modal has no accessibility violations" test (line 137) also relies on at least one card existing — if you run cancel.spec.ts first on a fresh DB, both this test and the pre-seeded one fail.

Per `rules/testing.md` ("Tests must be deterministic — no flaky tests allowed") and the capstone passing condition ("`pnpm install && pnpm build && pnpm test && pnpm lint && pnpm typecheck` all green from a fresh checkout"), the test suite must be self-contained.

## Expected

A fresh `pnpm install && pnpm test:e2e` (or `pnpm dev` followed by the e2e run) must pass without a manual seed step. Either:

- The Playwright config runs the seed in `globalSetup`, or
- The `pnpm dev` command pipes through the seed step (e.g., a prestart hook), or
- The spec creates its own pre-completed quest via API instead of relying on a hardcoded title.

## Fix

Option A (minimal, recommended): add a `globalSetup` to `playwright.config.ts`:

```ts
// playwright.config.ts
export default defineConfig({
  globalSetup: './packages/client/tests/e2e/global-setup.ts',
  // ...
});
```

```ts
// packages/client/tests/e2e/global-setup.ts
import { execSync } from 'node:child_process';
export default async function globalSetup() {
  execSync('pnpm --filter=@code-quests/server tsx src/scripts/seed-dev.ts', { stdio: 'inherit' });
}
```

This guarantees the seed runs once before any test starts (and seed-dev.ts is already idempotent).

Option B: the "pre-seeded completed quest" test should create its own quest (via the existing API helper) rather than asserting on a literal seeded title. The `returned-quest detail modal` test is already tolerant via `.first()`, but should be reordered after a test that has guaranteed at least one completed quest.

Either way, re-run the full `pnpm test:e2e` from a fresh DB (delete `~/.code-quests/db.sqlite` first) and confirm everything passes without manual seeding.

# BUG: Stale VITE_PHASER_TOWN references remain after the flag was removed

**Severity:** LOW
**File(s):** packages/client/src/vite-env.d.ts, packages/client/vitest.config.ts

## Problem

The task spec calls for removing the `VITE_PHASER_TOWN` flag entirely (`the VITE_PHASER_TOWN flag is removed; Phaser town is now the only town`). The flag was removed from `playwright.config.ts`, `app.tsx`, and `town.tsx`, but two stale references remain in the client package:

1. `packages/client/src/vite-env.d.ts` line 4 — still declares `readonly VITE_PHASER_TOWN?: string;` inside `ImportMetaEnv`. Nothing in the codebase reads this anymore; the type widens `import.meta.env` for a flag that no longer exists.

2. `packages/client/vitest.config.ts` line 7-8 — still defines `'import.meta.env.VITE_PHASER_TOWN': JSON.stringify('false')` with the comment `// Tests run in jsdom which doesn't support WebGL — disable Phaser in unit tests`. The defines and the comment both refer to a behavior (HTML fallback) that no longer exists; unit tests instead mock `phaser-mount` directly.

Leaves the next developer wondering whether the flag is still meaningful and grep'ing for VITE_PHASER_TOWN turns up false positives. Per `code-quality.md` "Dead code — No commented-out code in committed files — git has history" and the analogous principle for dead types/config: delete it.

## Expected

After removing the flag, every reference to it in committed source should be gone.

## Fix

1. In `packages/client/src/vite-env.d.ts`, remove the `VITE_PHASER_TOWN` field. If `ImportMetaEnv` becomes empty, replace its body with a comment placeholder or remove the interface entirely (only the `/// <reference types="vite/client" />` line is required).

2. In `packages/client/vitest.config.ts`, remove the entire `define: { 'import.meta.env.VITE_PHASER_TOWN': ... }` block and its preceding comment.

3. After the edits, grep the repo to confirm zero remaining references in `packages/`:
   `grep -rn "VITE_PHASER_TOWN" packages/`

Then re-run `pnpm typecheck && pnpm test && pnpm lint` to confirm nothing depends on the removed type.

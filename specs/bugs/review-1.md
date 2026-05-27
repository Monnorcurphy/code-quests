# BUG: Server `dev` script does not actually start a server

**Severity:** HIGH
**File(s):** packages/server/src/index.ts, packages/server/package.json

## Problem

`packages/server/src/index.ts` creates an Express `app` and registers a `/health` route, but it never calls `app.listen()`. The package's `dev` script (`node dist/index.js`) loads the module and immediately exits because nothing keeps the Node.js event loop alive. Verified by running `node packages/server/dist/index.js &` — the process exits within milliseconds.

Side effects:
1. `pnpm dev` from the root silently produces a non-functional backend. Only the Vite client on port 5173 stays alive, so the factory's `checks/smoke-test.sh` passes for the wrong reason — it claims success even though the server is fundamentally broken.
2. On a clean checkout (after `pnpm install` but before `pnpm build`), `pnpm dev` fails for the server because `dist/index.js` does not yet exist (`MODULE_NOT_FOUND`).
3. The dev script is misleading to anyone reading `package.json`.

This is exactly the failure mode the rules call out: *"misconfiguration that silently produces wrong output"* (HIGH severity per the review contract).

## Expected

The factory profile and project tech-stack section of CLAUDE.md describe an Express backend. A `dev` script must, at minimum, start a listening HTTP server or be removed/no-opped explicitly. Per the review contract, scripts that silently succeed while doing nothing useful must be fixed.

The smoke test (`checks/smoke-test.sh`) should also verify both the client (5173) and server (e.g., 3000) — currently a `||` between the two means either alone counts as success.

## Fix

Pick one of these approaches (preferred listed first):

1. **Add an entry point that listens** when the module is invoked directly:
   ```ts
   // packages/server/src/index.ts
   import express from 'express';

   const app = express();
   app.get('/health', (_req, res) => res.json({ status: 'ok' }));
   export { app };

   if (require.main === module) {
     const port = Number(process.env.PORT) || 3000;
     app.listen(port, () => {
       // Use a structured logger if/when added; this is the only acceptable
       // location for stdout in the server package.
       process.stdout.write(`server listening on :${port}\n`);
     });
   }
   ```
   This keeps the tests (which import `app`) unaffected because `require.main === module` is false during import.

2. **Switch `dev` to run TypeScript directly via `tsx`** so a clean checkout can `pnpm install && pnpm dev` without a separate build step:
   ```json
   "dev": "tsx watch src/index.ts"
   ```
   Add `tsx` to `devDependencies`. Combine with the listen guard above.

3. **If a runtime server is out of scope for this foundation task**, remove the `dev` script from `packages/server/package.json` entirely so the broken behavior is not silently advertised, and update the factory smoke test to only target the client.

After fixing, update `checks/smoke-test.sh` to verify BOTH endpoints with `&&` (not `||`) so a regression in either side fails the smoke check.

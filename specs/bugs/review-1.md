# BUG: Recruit/roster API calls fail in browser — no CORS on server, no Vite proxy
**Severity:** HIGH
**File(s):** `packages/server/src/index.ts`, `packages/client/vite.config.ts`, `packages/client/src/lib/api.ts`

## Problem

Bran's recruit + roster feature depends on the browser successfully calling `http://localhost:4001` from the Vite dev server (default `http://localhost:5173`). Those are two different origins, so the browser enforces CORS on every request.

- `packages/server/src/index.ts` registers no CORS middleware (no `cors` package in `packages/server/package.json` either).
- `packages/client/vite.config.ts` has no `server.proxy` entry.
- `packages/client/src/lib/api.ts` hardcodes `const BASE_URL = 'http://localhost:4001'` and calls `fetch(`${BASE_URL}${path}`)` directly from the page.

Result in a real browser:
- `GET /adventurers` (roster fetch on Guild Hall / Town Square open) — fetch resolves but the response is opaque (no `Access-Control-Allow-Origin`), so TanStack Query receives a network error and the Roster component renders its `roster-error` state ("Could not load the roster. Try again later.").
- `POST /adventurers` (recruit submit) — preflight `OPTIONS` request gets no CORS headers, browser blocks the request, the optimistic insert is rolled back, and the user sees a generic "Failed to fetch" error.

The verify pipeline missed this because:
- All Vitest suites mock `api.adventurers.list` / `api.adventurers.create` (`recruit-modal.test.tsx:9`, `town.test.tsx:8`), so the real `fetch` never runs.
- `scripts/smoke-test.sh` only checks that Vite responds at `:5173` — it never hits the API from the browser.

Per the review contract's Capstone Coverage requirement ("A human can walk through and interact with everything the phase built"), the recruit flow is not interactable end-to-end, and per `rules/common-findings.md` §7 ("Build chain misconfiguration — silent failures"), a feature that ships built and tested but cannot work in a real browser is a HIGH-severity misconfiguration.

## Expected

The recruit flow must work end-to-end when the user runs `pnpm dev` and opens the Town Square in a browser: GET roster, POST recruit, and the new adventurer appears.

## Fix

Pick one of:

1. **Vite dev proxy (recommended for local dev — no server change).** In `packages/client/vite.config.ts`, add a proxy and update `BASE_URL` to use a relative path:

   ```ts
   // vite.config.ts
   export default defineConfig({
     plugins: [react()],
     resolve: { alias: { '@code-quests/shared': path.resolve(__dirname, '../shared/src/index.ts') } },
     server: {
       proxy: {
         '/adventurers': 'http://localhost:4001',
         '/epics': 'http://localhost:4001',
         '/quests': 'http://localhost:4001',
         '/health': 'http://localhost:4001',
       },
     },
   });
   ```

   ```ts
   // packages/client/src/lib/api.ts
   const BASE_URL = ''; // same-origin via Vite proxy
   ```

2. **CORS middleware on the server.** Add `cors` to `packages/server/package.json` deps, then in `packages/server/src/index.ts`:

   ```ts
   import cors from 'cors';
   // ...
   const app = express();
   app.use(cors({ origin: 'http://localhost:5173' }));
   app.use(express.json());
   ```

Either fix is acceptable. Then extend `scripts/smoke-test.sh` (or add a new check) that boots the server, opens the Vite dev page, and hits `GET /adventurers` from the browser context (or at minimum a `curl -H "Origin: http://localhost:5173"` against the server to confirm `Access-Control-Allow-Origin` is set) so this can never silently regress again.

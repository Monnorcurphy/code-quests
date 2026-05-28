# BUG: Vite dev server does not proxy /test/* — capstone E2E cannot reach test-emit route

**Severity:** CRITICAL
**File(s):** packages/client/vite.config.ts, packages/client/tests/e2e/phase-5-capstone.spec.ts

## Problem

`packages/client/vite.config.ts` proxies only these paths to `http://localhost:4001`:

```ts
proxy: {
  '/adventurers': 'http://localhost:4001',
  '/epics': 'http://localhost:4001',
  '/quests': 'http://localhost:4001',
  '/health': 'http://localhost:4001',
},
```

`/test` is missing. The Phase 5 capstone E2E test issues:

```ts
const emitRes = await page.request.post('/test/emit-quest-event', { ... });
expect(emitRes.status()).toBe(200);
```

`page.request` uses the configured `baseURL` (`http://localhost:5173`), so the request goes to **Vite**, not the server at `:4001`. Vite returns 404 for unknown POST paths. Reproduced:

```
$ curl -s -X POST -H "Content-Type: application/json" -d '{}' -w "%{http_code}\n" -o /dev/null http://localhost:5173/test/emit-quest-event
404
```

This breaks:
- `phase-5-capstone.spec.ts:54-65` (full walkthrough scene-change step)
- `phase-5-capstone.spec.ts:120-130` (test-emit availability test)

Even with the seed fix from review-1, the test endpoint will be unreachable from the browser-side test code via the dev server.

## Expected

The `POST /test/emit-quest-event` route, which the server mounts when `NODE_ENV=test`, must be reachable through the dev server during E2E runs. The capstone spec requires:

> Simulate a server event via a test-only debug endpoint (`POST /test/emit-quest-event`) that emits `scene_change` to boss-room → assert HUD reflects it.

## Fix

Add `/test` to the Vite proxy configuration:

```ts
proxy: {
  '/adventurers': 'http://localhost:4001',
  '/epics': 'http://localhost:4001',
  '/quests': 'http://localhost:4001',
  '/health': 'http://localhost:4001',
  '/test': 'http://localhost:4001',
},
```

After the fix, re-run the capstone E2E and confirm both the walkthrough scene-change emit and the test-emit availability test pass.

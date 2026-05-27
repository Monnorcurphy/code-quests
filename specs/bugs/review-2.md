# BUG: errorHandler silently swallows the underlying error

**Severity:** HIGH
**File(s):** `packages/server/src/middleware/errors.ts`

## Problem

```ts
export function errorHandler(_err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
}
```

`_err` is discarded — never logged, never propagated. Every uncaught exception in a route (DB constraint violation, JSON parse failure, programmer error, etc.) becomes an opaque "Internal server error" 500 with zero diagnostic trail.

This is the exact pattern called out in `common-findings.md` #8 ("Silent error swallowing — 18 tasks across 2 projects"):

> Empty `catch {}` blocks — errors disappear, user sees nothing
> Fix: every catch block must surface the error OR have `// intentionally swallowed: <reason>`

Concrete impact:
- `POST /quests` with an unknown `epicId` triggers an SQLite `FOREIGN KEY constraint failed` — the operator sees only `500 Internal server error` with no clue what failed.
- A malformed JSON body request body parser error path is similarly lost.
- This will become impossible to debug once the server is running anywhere other than a developer's laptop.

## Expected

Per the constitution and `common-findings.md` #8, the error must be surfaced (logged to stderr or a structured logger) OR have an explicit comment justifying the silence.

The `no-console: error` ESLint rule prevents `console.error`, so use `process.stderr.write` (already the pattern used in `index.ts` for stdout) or introduce a small logger module.

## Fix

```ts
import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  process.stderr.write(`[server] unhandled error: ${err.stack ?? err.message}\n`);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
}
```

Add a test that asserts a thrown error inside a route both produces a 500 AND writes to stderr (capture via a vi.spyOn on `process.stderr.write`).

While here, consider catching SQLite `SQLITE_CONSTRAINT_FOREIGNKEY` / `SQLITE_CONSTRAINT_CHECK` and returning a 400 with a field-named message (see review-3.md).

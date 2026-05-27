# BUG: Importing server `index.ts` opens the user's real database during tests

**Severity:** HIGH
**File(s):** `packages/server/src/index.ts`, `packages/server/src/index.test.ts`, `packages/server/src/db/connection.ts`

## Problem

`packages/server/src/index.ts` executes side-effects at module-load time:

```ts
const db = openDb();          // line 9 — no path arg, uses default DB_PATH
runMigrations(db);            // line 10
```

`openDb()` with no argument defaults to `path.join(os.homedir(), '.code-quests', 'db.sqlite')` (see `connection.ts:9`). It also `mkdirSync`s the directory.

`packages/server/src/index.test.ts:2` does `import { app } from './index';`, which means **every test run executes those two lines against the user's real, on-disk database in `~/.code-quests/`**.

This was verified empirically:

```
$ ls -la ~/.code-quests/
-rw-r--r--  ... db.sqlite
-rw-r--r--  ... db.sqlite-shm     <-- timestamp updated by `pnpm -r test`
-rw-r--r--  ... db.sqlite-wal
```

Consequences:
- Tests are not hermetic — they read/write production data.
- On a clean CI box this still creates `~/.code-quests/` as a side effect of running tests.
- A future migration bug could corrupt or destroy the user's real data during a routine `pnpm test`.
- The rules ("Hard gate on broken state", "One task per session"/clean context, and `Test requirement: A unit test must verify that inserting a row with a non-existent FK reference raises an error` in `database-conventions.md`) presume tests run in isolation.

## Expected

- Tests must not touch any path outside the project / temp dir.
- The module that boots the server must not perform DB / FS work merely because it was imported.
- Standard pattern: export a `createApp(db)` factory; the production launcher (only reached when `require.main === module`) is the only thing that opens the real DB.

## Fix

In `packages/server/src/index.ts`, refactor so the side effects happen only inside the `if (require.main === module)` block:

```ts
import express from 'express';
import { openDb } from './db/connection';
import { runMigrations } from './db/migrator';
import { createAdventurersRouter } from './routes/adventurers';
import { createEpicsRouter } from './routes/epics';
import { createQuestsRouter } from './routes/quests';
import { errorHandler } from './middleware/errors';

export function createApp(db: import('better-sqlite3').Database) {
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/adventurers', createAdventurersRouter(db));
  app.use('/epics', createEpicsRouter(db));
  app.use('/quests', createQuestsRouter(db));
  app.use(errorHandler);
  return app;
}

if (require.main === module) {
  const db = openDb();
  runMigrations(db);
  const app = createApp(db);
  const port = Number(process.env.PORT) || 4001;
  app.listen(port, () => {
    process.stdout.write(`server listening on :${port}\n`);
  });
}
```

Then update `index.test.ts` to build the app from an in-memory DB (same pattern as the route tests):

```ts
import { describe, it, expect } from 'vitest';
import { openDb } from './db/connection';
import { runMigrations } from './db/migrator';
import { createApp } from './index';

describe('app', () => {
  it('exposes a /health route', async () => {
    const db = openDb(':memory:');
    runMigrations(db);
    const app = createApp(db);
    // assert via supertest, e.g.
    // const res = await request(app).get('/health');
    // expect(res.status).toBe(200);
  });
});
```

Delete `~/.code-quests/` once during cleanup if you want a clean slate.

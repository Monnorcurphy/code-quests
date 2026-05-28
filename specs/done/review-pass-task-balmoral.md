# Review Pass — task balmoral (Express CRUD API)

## Checks performed

- Read the task spec (`metrics/task-balmoral-context.md`) and verified each acceptance criterion against the implementation.
- Read every new source file in the diff once (routes, middleware, db connection/migrator, tests, shared schemas).
- Ran `pnpm -r test` — 5 server suites pass (61 tests), shared (40 tests), client (2 tests). 0 failures.
- Ran `pnpm lint` — clean.
- Ran `pnpm typecheck` — clean across all workspaces.
- Grep for secrets (`sk-`, `AKIA`, `api_key`, `password=`) — none.
- Cross-boundary validation: confirmed every Zod enum matches the SQLite `CHECK` constraints.
  - `AdventurerClassSchema` ⇔ `adventurers.class CHECK(...)`: `champion | ranger | scout | rogue | apprentice` — match.
  - `QuestStatusSchema` ⇔ `quests.status CHECK(...)`: `idle | active | complete | failed | paused_input | user_blocked` — match.
- FK pragma: `openDb()` sets `PRAGMA foreign_keys = ON`; covered by `connection.test.ts` ("throws on FK violation").
- AC lock check works as written: PATCH rejects `acceptanceCriteria` when `ac_locked_at` is non-null and returns the documented `{ error, field }` shape (`quests.ts:113-119`).
- Empty-array list endpoints return `200 []` (tests cover this).
- HTTP codes used as required: 200 / 201 / 204 / 400 / 404 — verified in route source and tests.

## Bugs filed

1. **review-1.md (HIGH)** — `packages/server/src/index.ts` runs `openDb()` + `runMigrations()` at module load. `index.test.ts` imports it, so `pnpm test` writes to the user's real `~/.code-quests/db.sqlite` (verified by inspecting timestamps after a test run). Tests must be hermetic. Refactor to a `createApp(db)` factory.
2. **review-2.md (HIGH)** — `middleware/errors.ts` discards `err` entirely. Every uncaught route exception becomes an opaque 500 with no log. `common-findings.md` #8 calls this out explicitly; the ESLint `no-console: error` rule makes `process.stderr.write` the right replacement.
3. **review-3.md (LOW)** — POST/PATCH `/quests` with an unknown `epicId` / `adventurerId` triggers a SQLite FK violation that surfaces as a generic 500 instead of the field-named 400 the acceptance criteria require. No integration tests cover this path. Add API-layer existence checks (or translate SQLite errors in the handler) and add tests.

## INFORMATIONAL notes

- **AC lock activation is intentionally external.** The task spec says the lock applies "once `status` has progressed past `posted`", but `posted` is not a value in the `QuestStatusSchema` enum. The implementation requires `ac_locked_at` to be set out-of-band (e.g. by a future `/quests/:id/claim` endpoint). Current PATCH correctly rejects AC mutations once that field is non-null. This is reasonable forward-compatibility — no fix needed in this task — but the future claim endpoint must set `ac_locked_at` at the same time it sets `adventurer_id`, otherwise the lock will never fire.
- **`crypto.randomUUID()` is used without an explicit import** in `routes/adventurers.ts`, `epics.ts`, and `quests.ts`. Works because Node 20 exposes `crypto` globally. Tests and typecheck pass, but `import { randomUUID } from 'node:crypto'` would be more portable and easier to mock.
- **`app._router.stack` is an Express internal**, used in `index.test.ts` to enumerate routes. It will continue to work in Express 4 but is undocumented. Once the `createApp` refactor in review-1.md lands, prefer asserting on behavior via supertest (`GET /health` → 200) rather than poking at `_router`.
- **Build step `cp -r src/db/migrations dist/db/`** in `packages/server/package.json` depends on `dist/db/` existing after `tsc` emits — it does today (because `migrator.js` lives at `dist/db/migrator.js`), but if `migrator.ts` ever moves out of `src/db/`, the cp would silently flatten the migrations directory. Worth a follow-up in a later task.

## Verdict

**FAIL** — 3 bugs filed (2 HIGH, 1 LOW). Acceptance criteria are otherwise met; tests, lint, and typecheck all pass.

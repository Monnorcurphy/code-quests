### TASK balmoral: Express API — CRUD endpoints

**Goal:** A REST API exposing CRUD for adventurers, epics, and quests, backed by the SQLite schema from `arundel`. All input validated via the Zod schemas from `ashford`.

**Files to create/modify:**
- `packages/server/src/index.ts` — Express app, listens on configurable port (default 4001)
- `packages/server/src/routes/adventurers.ts` — `GET /adventurers`, `POST /adventurers`, `GET /adventurers/:id`, `PATCH /adventurers/:id`, `DELETE /adventurers/:id`
- `packages/server/src/routes/epics.ts` — same shape
- `packages/server/src/routes/quests.ts` — same shape; **PATCH must reject AC mutations once `status` has progressed past `posted`** (ACs lock at claim time per founding doc §3 / data model)
- `packages/server/src/middleware/validate.ts` — Zod-based body validator
- `packages/server/src/middleware/errors.ts` — structured error responses
- `packages/server/src/__tests__/*.test.ts` — integration tests using supertest + an in-memory SQLite DB

**Acceptance criteria:**
- 200/201/204/400/404 status codes used correctly
- Body validation rejects malformed input with field-named errors
- AC lock rule enforced: try to PATCH `acceptance_criteria` on a `claimed` quest → 400 with explicit message
- All endpoints have integration tests covering happy + error paths
- Error responses are JSON with `{ error: string, field?: string }` shape
- No `console.log` in production source (enforced by ESLint)

---


# Phase 1 — Town Skeleton (HUD only)

**Codename theme:** castles
**Status:** Ready to build

## Goal

Stand up the data and API foundations of Code Quests plus a minimal React HUD that lets the user **create adventurers, draft quests, and see them listed** — all backed by a real SQLite database and an Express API. No Phaser scenes yet; Phase 2 adds the 2D side-scroller. By the end of this phase, a human can launch the app and interact with the core domain end-to-end.

## Architecture Context

Read `specs/founding-document.md` for the full vision. For Phase 1 specifically:

- **Monorepo via pnpm workspaces.** Three packages:
  - `packages/server` — Express API + SQLite (better-sqlite3) + WebSocket (Phase 3+)
  - `packages/client` — React + Vite. Phaser will be added in Phase 2; Phase 1 is HUD only.
  - `packages/shared` — TypeScript types + Zod schemas shared across server/client
- **Local-first.** SQLite file under `~/.code-quests/db.sqlite`. No cloud sync in v1.
- **Domain entities for Phase 1:** `Quest`, `Epic`, `Adventurer`. `Monster`/`MonsterEncounter`/`Skill`/`Tool`/`MCPServer`/`Agent` come later — but the schema must reserve their tables so Phase 1 migrations don't paint us into a corner.
- **Town has buildings**, each with a discrete purpose (Town Square / War Room / Oracle / Library / Tavern / Armory / Guild Hall / Hall of Returns). Phase 1 renders these as plain React panels — Phase 2 turns them into a side-scrolling pixel-art scene.

## Tasks

The 7 tasks below are ordered by dependency. Each is self-contained and listed in `sequence.md` by codename.

---

### TASK alhambra: Monorepo + tooling setup

**Goal:** Initialize a pnpm monorepo with strict TypeScript, ESLint, Vitest, and a working `pnpm install && pnpm build && pnpm test && pnpm lint && pnpm typecheck` chain.

**Files to create/modify:**
- `package.json` — root, workspaces config, scripts that fan out
- `pnpm-workspace.yaml`
- `tsconfig.base.json` — strict mode
- `.eslintrc.cjs` (or flat config) — `@typescript-eslint/recommended`, `no-console: error`
- `packages/server/package.json`, `packages/server/tsconfig.json`
- `packages/client/package.json`, `packages/client/tsconfig.json` (Vite + React)
- `packages/shared/package.json`, `packages/shared/tsconfig.json`
- A minimal "hello world" entry in each package so `pnpm build` and `pnpm test` actually pass

**Acceptance criteria:**
- `pnpm install` succeeds from a clean checkout
- `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck` all exit 0
- `tsc --noEmit` finds zero `any` and strict mode is enforced
- Each package emits at least one passing Vitest test (smoke)

---

### TASK arundel: SQLite schema + migrations

**Goal:** Create the SQLite schema for Phase 1 entities, plus stubbed-but-reserved tables for the entities that arrive in later phases (so we don't have to drop the DB later).

**Files to create/modify:**
- `packages/server/src/db/connection.ts` — better-sqlite3 connection helper; opens DB at `~/.code-quests/db.sqlite`; ensures dir; sets `PRAGMA foreign_keys = ON`
- `packages/server/src/db/migrations/001_init.sql` — full schema
- `packages/server/src/db/migrator.ts` — minimal forward-only migrator that runs `.sql` files in order
- `packages/server/src/db/__tests__/connection.test.ts` — verifies FK pragma is ON; insert/read/update/delete for each Phase 1 table

**Phase 1 tables (must be implemented):**
- `adventurers` — id, name, class, model_id, created_at, stats_json, specializations_json, scars_json
- `epics` — id, title, goal, created_at
- `quests` — id, epic_id (FK nullable), title, description, acceptance_criteria_json, edge_cases_json, context, status, adventurer_id (FK nullable), agent_id nullable, equipment_json, spec_audit_json, created_at, updated_at, ac_locked_at, input_request_json nullable, user_blocker_json nullable, failure_summary_json nullable, user_feedback_json

**Reserved tables (create schema, no API yet):**
- `agents` — id, adventurer_id (FK), quest_id (FK), started_at, ended_at, pid, exit_code
- `monster_types` — id, name, sprite_path, default_difficulty, failure_signature, created_by
- `monsters` — id, type_id (FK), name, scope ('project'|'guild'), project_id nullable, first_seen_at, last_seen_at, encounters, defeats, escapes, calibrated_difficulty, notes
- `monster_encounters` — id, monster_id (FK), quest_id (FK), appeared_at, combat_log_json, outcome, loot_json
- `skills` — id, name, monster_type_ids_json, status, created_by, created_at, hit_count, implementation
- `tools` — id, name, description, invocation
- `mcp_servers` — id, name, config_json

**Acceptance criteria:**
- Migrator runs idempotently
- `PRAGMA foreign_keys = ON` enforced in both production and test DB init
- All Phase 1 tables have full CRUD tests
- Reserved tables exist after migration (verified by a `sqlite_master` query in a test)
- A FK violation throws (proves pragma is live)

---

### TASK ashford: Shared types + Zod schemas

**Goal:** Define the runtime-validated types for every entity that crosses the server↔client boundary. Used by both Express handlers (server) and fetch wrappers (client).

**Files to create/modify:**
- `packages/shared/src/index.ts` — re-exports
- `packages/shared/src/quest.ts` — `QuestSchema`, `EpicSchema` (Zod) + `Quest`, `Epic` types via `z.infer`
- `packages/shared/src/adventurer.ts` — `AdventurerSchema`, `AdventurerClass` enum
- `packages/shared/src/equipment.ts` — `EquipmentSchema` (skillIds/toolIds/mcpServerIds)
- `packages/shared/src/__tests__/*.test.ts` — parse/reject tests for each schema

**Acceptance criteria:**
- Every schema rejects invalid input with a meaningful Zod error
- Status enum values match the DB CHECK constraint values exactly (cross-boundary parity)
- `AdventurerClass` enum values match the DB CHECK constraint values exactly
- `import { QuestSchema } from '@code-quests/shared'` works from both server and client

---

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

### TASK bodiam: React HUD skeleton

**Goal:** Stand up the Vite + React client with TanStack Query, Zustand, react-router, and a Town-themed shell that loads. No Phaser yet — this is pure HTML/CSS/React.

**Files to create/modify:**
- `packages/client/index.html`, `packages/client/vite.config.ts`
- `packages/client/src/main.tsx`, `packages/client/src/app.tsx`
- `packages/client/src/lib/api.ts` — typed fetch wrappers using shared Zod schemas to parse responses
- `packages/client/src/lib/query-client.ts` — TanStack Query setup
- `packages/client/src/routes/town.tsx` — Town Square shell with 8 building panels (Town Square, War Room, Oracle, Library, Tavern, Armory, Guild Hall, Hall of Returns) as plain styled cards/buttons. Each opens a placeholder modal saying "Coming in Phase 2 — Phaser scene".
- `packages/client/src/styles/*` — basic medieval-themed CSS (parchment off-white, stone gray, banner-red accents). No external CSS framework required for Phase 1; can use Tailwind if preferred but Tailwind setup must follow `rules/builder/build-checklist.md`.
- `packages/client/src/__tests__/town.test.tsx` — render test + nav test

**Acceptance criteria:**
- `pnpm --filter @code-quests/client dev` launches Vite and serves the Town view
- Town Square renders all 8 building entries
- Clicking any building opens the placeholder modal (no console errors)
- All contrast ratios ≥ 4.5:1 (no `text-gray-400` family — per `rules/domain/frontend/accessibility.md`)
- Keyboard nav works: Tab through buildings, Enter to open, Escape to close
- Render test + at least one interaction test pass

---

### TASK bran: Adventurer recruit flow + roster

**Goal:** Implement the "spin up a new adventurer from the Town Square" flow end-to-end (US-7 from founding doc §9). Display the guild roster (read from API) and let the user add new adventurers via a recruit modal.

**Files to create/modify:**
- `packages/client/src/features/guild/roster.tsx` — list of adventurers (name, class, wins/losses)
- `packages/client/src/features/guild/recruit-modal.tsx` — form with name + class select (`Champion`/`Ranger`/`Scout`/`Rogue`/`Apprentice`); validated via shared Zod schema; POST to `/adventurers`; on success, optimistic-add via TanStack Query
- `packages/client/src/features/guild/guild-hall.tsx` — the Guild Hall building view; shows roster + recruit button
- `packages/client/src/features/town-square.tsx` — Town Square view; mounts roster as a side panel + recruit banner button
- `packages/client/src/__tests__/recruit-modal.test.tsx` — render, submit happy path, submit invalid path

**Acceptance criteria:**
- Three states required per `rules/domain/frontend/ux-feedback.md`: loading (spinner + disabled submit), success (auto-dismiss after 3s), error (persists until user dismisses)
- Class selector is a `<select>` constrained to the 5 valid classes (no free text — per `rules/domain/frontend/input-validation.md`)
- Name field validated: 1–80 chars, trim, no empty submit
- Failed POST shows the server's field-named error inline (not a generic "failed to save")
- Optimistic insert reverts on error
- New adventurer immediately visible in the roster
- aria-live region announces success to screen readers
- Tests cover the success state, validation error, and server error

---

### TASK caernarfon: Quest draft flow + Quest Board (CAPSTONE)

**Goal:** End-to-end Phase 1 capstone. A human can launch the app, recruit an adventurer, draft a quest with acceptance criteria, see it on the Town Square's Quest Board, and reload to confirm persistence. Every Phase 1 feature is reachable from the entry point — per `rules/spec/phase-capstone.md`.

**Files to create/modify:**
- `packages/client/src/features/quests/draft-form.tsx` — title, description, AC list (add/remove rows — each constrained to 1–500 chars), optional epic dropdown
- `packages/client/src/features/quests/quest-board.tsx` — list of quests with status badges (`drafted`/`posted`)
- `packages/client/src/features/war-room.tsx` — the War Room building view; embeds the draft form
- `packages/client/src/features/town-square.tsx` — extend to mount Quest Board front-and-center (the Board is on the wall in the Square per founding doc §2)
- `packages/server/src/scripts/seed-dev.ts` — optional dev-only seed: 1 epic + 2 quests + 1 adventurer for first-launch demo
- `README.md` — root: how to install (`pnpm install`), how to run (`pnpm dev`), what to expect (the 8 buildings, the recruit flow, the draft flow)
- `assets/CREDITS.md` — initialize the file (empty for Phase 1; Phase 2 populates with art credits)
- `packages/client/tests/e2e/phase-1-capstone.spec.ts` — Playwright E2E walkthrough

**Acceptance criteria (human interaction path — per `rules/spec/phase-capstone.md`):**
1. Developer runs `pnpm install && pnpm dev` from the root → both server and client launch
2. Browser opens to the Town Square → 8 buildings visible
3. User clicks the recruit banner in Town Square → recruit modal opens → enters name "Brielle the Bold", picks "Champion" → submits → "Brielle the Bold" appears in the Guild Hall roster (visible in side panel)
4. User clicks "War Room" → draft form opens → types title "Implement dark mode toggle", description, adds two ACs → submits → quest appears on the Quest Board in `drafted` status
5. User refreshes the browser → adventurer and quest persist (proves SQLite + API write succeeded)
6. Playwright E2E test runs this entire journey headlessly and passes

**Additional capstone-specific checks:**
- Every Phase 1 feature is reachable from the Town Square (no orphan screens)
- Axe-core accessibility scan finds zero violations on Town Square, War Room, recruit modal, draft form
- No empty states left blank: empty roster says "No adventurers yet — recruit your first hero"; empty Quest Board says "No quests yet — visit the War Room to draft one"
- ESLint, typecheck, all tests green
- Branch is `feature/caernarfon`; PR description summarizes the human walkthrough

---

## Passing Conditions (Phase-level)

- [ ] `pnpm install && pnpm build && pnpm test && pnpm lint && pnpm typecheck` all green from a fresh checkout
- [ ] SQLite DB created with all Phase 1 tables + all reserved (later-phase) tables
- [ ] Every CRUD endpoint has integration tests; AC lock rule enforced
- [ ] Zod schemas shared and used by both server validation and client parsing
- [ ] Recruit flow works end-to-end with proper loading/success/error states
- [ ] Quest draft flow works end-to-end with persistence verified by browser reload
- [ ] Playwright capstone test passes headlessly
- [ ] Axe-core scan: zero violations on the four key surfaces
- [ ] All contrast ratios ≥ WCAG AA 4.5:1
- [ ] No `console.log` in production source
- [ ] Capstone PR opened with the human walkthrough in the description

## Known Constraints (carry-forward for Phase 2+)

- Town and Quest will be re-rendered in Phaser in Phase 2. Phase 1 React structures should be designed so they can be embedded as HUD overlays on top of the Phaser canvas later — don't bake Town visuals so deeply into the page layout that swapping to a canvas is painful.
- WebSocket/realtime is Phase 3+. Phase 1 uses request/response polling via TanStack Query.
- Agent subprocess spawning is Phase 4. Phase 1 only tracks the *data model* — there's no actual agent execution yet.

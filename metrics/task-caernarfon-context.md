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

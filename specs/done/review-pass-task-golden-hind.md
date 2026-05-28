# Review Pass — Task golden-hind (Phase 6 Capstone)

**Reviewer:** Reviewer agent
**Branch:** feature/golden-hind (parent: feature/intrepid)
**Date:** 2026-05-28
**Verdict:** FAIL (3 bugs filed: 2 HIGH, 1 LOW)

## Checks performed

1. **Diff read** — read the full pre-computed diff (1484 ins / 95 del, 18 files).
   Lockfile noise was already excluded.
2. **Build** — `pnpm build` → all three packages built cleanly (one pre-existing
   Vite chunk-size warning on `phaser-mount`, unchanged by this PR).
3. **Typecheck** — `pnpm typecheck` → green for shared, server, client.
4. **Lint** — `pnpm lint` → zero warnings, zero errors.
5. **Unit + integration tests**:
   - `packages/server`: 301 tests pass across 23 files.
   - `packages/client`: 559 tests pass across 43 files (includes new bestiary scope-tab
     tests and the existing monster-detail / promote modal tests).
6. **Secret scan** — grepped diff for `sk-`, `AKIA`, `api_key`, `password=` → none.
7. **Console-log scan** — grepped new `src/scripts/` and `src/features/library/` for
   `console.*` → none. Server scripts correctly use `process.stdout.write` /
   `process.stderr.write`.
8. **Contrast safelist** — grepped diff for banned Tailwind classes
   (`text-{gray,neutral,slate,zinc}-{100..400}`) → none introduced by this PR.
   (Pre-existing instances in `hud-overlay.tsx` are outside this task's scope.)
9. **Cross-boundary parity (per review-contract.md)**:
   - `monsters.scope` DB CHECK `('project','guild')` ↔ `MonsterScopeSchema = z.enum(['project','guild'])` ↔ TS `MonsterScope` — **match**.
   - `monster_encounters.outcome` DB CHECK `('victory','defeat','escape')` ↔
     `MonsterEncounterSchema.outcome = z.enum(['victory','defeat','escape'])` ↔ TS union — **match**.
   - `monster_types.created_by` — DB has no CHECK (TEXT) but Zod `z.enum(['system','user'])`
     enforces it on read. Since the DB is more permissive than the Zod schema and the
     seed only inserts `'system'`, this is INFORMATIONAL (see notes below), not a bug.
   - `POST /monsters/:id/promote-nemesis` request body: `z.object({ name: z.string().min(1).max(120).optional() })`
     ↔ client `api.monsters.promoteNemesis(id, name?)` — **match**.
10. **Binary asset check** — all 10 monster sprites in
    `packages/client/public/assets/monsters/` are > 4 KB and credited in
    `assets/CREDITS.md` (lines 181–190).
11. **Capstone coverage** (mandatory per review-contract.md):
    - Monster detection: reachable via real quest run, replay-failures.ts, and seed.
    - Lich aggregator: reachable; integration tested at quest-runner level.
    - Bestiary tab: default tab in Library modal (reachable from Town Square
      sidebar "Open Library" button AND from the Library scene via the Phaser door).
    - Bestiary scope filter (Project/Guild): present at top of Bestiary.
    - Monster detail / encounter history: reachable by clicking any bestiary row.
    - Mark-as-Nemesis: reachable on every project-scope monster detail.
    - Nemesis promotion modal: opens from the Mark-as-Nemesis button.
    - Library badge / Town Square Library preview: rendered conditionally on
      monster count > 0.
    - **No dead-end screens.** Every Phase 6 feature is reachable from Town Square.
12. **Migration / seed verification** — `seed-demo-quest.ts` runs idempotently;
    re-running on an already-seeded DB is a no-op (every insert is guarded by an
    existence check).
13. **E2E test file** read end-to-end — 13 scenarios covering Library nav, Bestiary
    discoverability, scope tabs, seeded monster visibility, monster detail, promote
    flow, Nemeses tab, axe scan, badge, town-square card, demo quest in DB,
    persistence after refresh, combat HUD axe scan with monster present.

## Bugs filed

| File | Severity | Summary |
|---|---|---|
| specs/bugs/review-1.md | HIGH | `PromoteNemesisModal` lacks focus management (no initial focus, no trap, no return). |
| specs/bugs/review-2.md | HIGH | New CSS classes (`bestiary-scope-tab--active`, `nemesis-badge`, `library-bestiary-badge`, `promote-modal`, `promote-success`, `town-square-library-*`, `library-header`, `monster-detail-actions`, `promote-form`) referenced but undefined — active scope tab is visually indistinguishable from inactive. |
| specs/bugs/review-3.md | LOW | quest-runner.test.ts line 831 test name "does not spawn a second lich…" contradicts its `expect(...).toBe(2)` assertion. |

## INFORMATIONAL notes (not filed as bugs)

1. **`MONSTER_PROJECT_ID` vs. `seed-demo-quest.ts` project_id.** The production
   `recordEncounter()` (`monster-detection.ts:110`) defaults the `project_id` field
   to the constant `MONSTER_PROJECT_ID = 'local'`. The seed script
   (`seed-demo-quest.ts:118-131`) instead uses `projectId: questId`. This means a
   monster created by the seed is NOT the "same row" as a monster created by a real
   quest run of the same type (different `project_id`). The bestiary doesn't filter
   by `project_id`, so both show up correctly — but if the user runs both the seed
   AND `replay-failures.ts` for the same monster type, two distinct monster rows
   will exist for what is conceptually one creature. This is the kind of
   inconsistency the Phase 6 founding doc tried to avoid by requiring
   `findMonsterBySignature` to return a single row for `(projectId, typeId, signature)`.
   Consider following up by making the seed use `MONSTER_PROJECT_ID` directly so
   replay and seed converge.

2. **Bestiary scope tabs missing `aria-controls` / `tabpanel` wiring.** The two
   scope-tab buttons in `bestiary.tsx` correctly use `role="tab"`, `role="tablist"`,
   and `aria-selected`, but the table content area below is not marked as a
   `role="tabpanel"` and the tabs don't have `aria-controls` pointing to it. The
   library-section tabs in `library.tsx` DO have full tab-panel wiring; the new
   scope tabs in bestiary do not. Not a blocker — screen readers still read the
   updated table — but it's an incomplete ARIA tab pattern that would benefit from
   wiring for consistency with the rest of the codebase.

3. **`monster_types.created_by` lacks a DB CHECK.** Zod constrains it to
   `'system' | 'user'`, but the migration just stores TEXT. Out of scope for this
   capstone — flagged for Phase 10 when user-defined `MonsterType`s are added (the
   spec already mentions `created_by='user'`).

4. **One-time `setTimeout` in `MonsterDetail.handlePromoteSuccess` (line 167)** is
   not cleared on unmount. If the user backs out of the detail view within 4
   seconds of a successful promotion, the timer fires on an unmounted component.
   React will console-warn in dev but it isn't a functional bug. Minor — consider
   storing the timeout id in a ref and clearing it in a cleanup effect.

5. **Lich aggregator test `it('does not spawn a second lich for a second distinct
   type hitting the threshold')`** has a misleading name (filed as review-3) but
   the BEHAVIOUR it asserts (one lich per distinct type) is correct and matches
   the implementation in `quest-runner.ts:103-134`.

## Final verdict

**FAIL — 3 bugs filed (2 HIGH, 1 LOW).**

The capstone covers the full human-interactable path, all tests pass, and the
cross-boundary contract is correct. The blockers are accessibility/UX: the promote
modal violates the focus-management contract, and the new visual elements (most
visibly the scope-tab active state) ship without CSS — making sighted users unable
to see which tab they're on. Both must be addressed before the phase can be
considered "every feature interactable" in the capstone sense.

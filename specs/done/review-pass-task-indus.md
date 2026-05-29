# Review Pass — Task indus (Phase 10 capstone: Library hub integration + learning loop)

**Branch:** feature/indus (parent: feature/ganges)
**Verdict:** FAIL — 5 bugs filed (3 HIGH, 2 LOW)

## Summary of checks performed

- Read task spec (`metrics/task-indus-context.md`), full pre-computed diff, all changed source files and adjacent context (Library, LoadoutPanel, town-store, SkillsTab, skill candidate detection service, seed-dev script, e2e test, scene wiring, API surface, equipment schema, CSS variables).
- `pnpm typecheck` — green
- `pnpm lint` — green (zero output)
- `pnpm test` — 976 unit tests pass in client, server tests not run inline but typecheck clean
- E2E test file analyzed statically against scene + modal wiring; did not execute Playwright (slow, scope of issues identified by inspection).
- Boundary contract validation:
  - `monster_types` constraint: `goblin_linter` exists in migration 006_monster_types_seed.sql, so seed-dev's FK to `goblin_linter` is valid.
  - `skills.status` enum (`candidate | active | retired`) — frontend filter logic and `evaluateSkillCandidate` agree.
  - `equipment.skillIds` round-trip — server-side patch handler not changed; existing contract.
- Accessibility: contrast classes audited (`#2e7d32` on `#e8f5e9` and `#f5f0e8` — both pass 4.5:1; `#2c2416` on `#fff8e1` passes). Focus-visible outlines present on the new ribbon button and chip.
- Secrets/CSP: no new secrets, no inline `<script>`, no `eval`. Grep for `sk-`, `AKIA`, `password=` in the diff — clean.
- `console.log` / debug output in production source — none in the diff.
- Capstone coverage (per `rules/review-contract.md` "Capstone Coverage"): the new Skills-tab default reset behavior, the Library news ribbon, the Armory chip, and Coin New Type are all reachable from Town Square per the wiring. However, the **E2E tests that prove that reachability are themselves broken** (see review-1, review-2, review-3) — meaning the capstone gate is not actually verified by the test suite.

## Bug summary

| # | Severity | Title | File |
|---|----------|-------|------|
| 1 | HIGH | Library news ribbon E2E never opens the Town Square modal — assertion will time out | tests/e2e/phase-10-capstone.spec.ts |
| 2 | HIGH | Armory chip E2E test does not test the chip — only checks "no quest selected" state | tests/e2e/phase-10-capstone.spec.ts |
| 3 | HIGH | E2E uses banned conditional assertions + silent error swallowing | tests/e2e/phase-10-capstone.spec.ts |
| 4 | LOW  | LibraryNewsRibbon misuses `role="alert"` for persistent UI | src/features/town-square.tsx |
| 5 | LOW  | Armory chip can highlight/scroll to a candidate or retired skill | src/features/armory/loadout-panel.tsx |

## Informational notes

- **Seed idempotency** — `seedPhase10Demo` correctly uses existence checks for adventurer/epic/quests/monster/encounters. Re-running `--phase-10-demo` will not duplicate rows. Good.
- **Skill query invalidation** — `SkillCandidateCard.scheduleQueryRefresh` invalidates `['skills']` which prefix-matches `['skills', 'candidates']`, so the Town Square ribbon updates after a confirm/dismiss. Good.
- **Library `mountedRef` pattern** — using a ref to guard the on-mount effect is correct: the ref is fresh on each mount, so `markLibraryOpened()` fires once per modal open. Strict-mode double-invoke is benign because `markLibraryOpened` is idempotent.
- **`api.equipment.skills` filter** — `(s) => s.status === 'active' || s.status === undefined` includes a dead branch (schema requires `status`). Not a bug, just dead defensive code; safe to simplify in a future cleanup.
- **`role="status"` would be appropriate for the toast-like success messages already used in `SkillCandidateCard`** — these correctly use `role="status"` / `aria-live="polite"`. Consistent.
- **README & walkthrough doc** — `README.md` and `specs/done/phase-10-walkthrough.md` were updated as required by the spec. Not reviewed line-by-line for prose quality (out of scope for the reviewer).
- **Pre-existing concern carried forward** — the Loadout panel rendering `candidate` and `retired` skills as selectable equipment predates this task; review-5 only addresses the visible regression the new chip introduces. A broader cleanup ticket could remove candidate/retired skills from the selectable list entirely.

## Verdict

**FAIL** — 5 bugs filed. The HIGH bugs are all in the capstone Playwright spec: the test file claims to validate the headline Phase 10 walkthrough steps but does not actually exercise (review-1 + review-2) and uses banned conditional patterns (review-3). Capstone acceptance criterion 5 ("Playwright capstone test passes headlessly in CI") is not met until these are fixed. The LOW bugs (accessibility misuse, chip scroll target) are quality issues that should also be addressed in this fix round per the review contract.

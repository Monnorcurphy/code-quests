# Review Pass — Task eclipse

**Task:** Capstone — Start Showcase Demo button + 12-step tour + stub adapter
**Branch:** feature/eclipse (parent: feature/earth-sign)
**Reviewer:** adversarial reviewer agent (separate session from builder)

## Checks performed

- Read pre-computed diff (~1,885 insertions across 19 files).
- Read task spec at `metrics/task-eclipse-context.md`.
- Read all new/modified source files: `tour-overlay.tsx`,
  `tour-store.ts`, `showcase-button.tsx`, `showcase-steps.ts`,
  `stub-adapter.ts`, `select-adapter.ts`, `api.ts`, `main.tsx`,
  `app.tsx`, `town-square.tsx`, `index.html`, `vite.config.ts`,
  `features.css`, `phase-11-capstone.spec.ts`.
- Verified the server-side `/showcase/reset` route enforces
  `CODE_QUESTS_ENV=demo` guard (returns 403 otherwise).
- Verified `select-adapter.ts` returns `stub` only in demo mode (test
  in `stub-adapter.test.ts` exercises both branches).
- Ran client suite: `pnpm --filter @code-quests/client test` →
  **72 files / 1020 tests pass**.
- Ran server suite: `pnpm --filter @code-quests/server test` →
  **41 files / 566 tests pass**.
- Ran `pnpm --filter @code-quests/client lint` → clean.
- Ran `pnpm --filter @code-quests/client typecheck` → clean.
- Ran `pnpm --filter @code-quests/server lint` → clean.
- Ran `pnpm --filter @code-quests/server typecheck` → clean.
- Grepped for hardcoded secrets (`sk-`, `AKIA`, `api_key`,
  `password=`) — none introduced by this task.
- Checked Tailwind contrast safelist (`text-{gray,neutral,slate}-{100..400}`)
  in new CSS — no violations; new colors use variables or HEX outside
  the safelist range.
- Verified `import.meta.env.VITE_CODE_QUESTS_ENV` is exposed by Vite
  config — required for the demo-mode check in `showcase-button.tsx`.
- Walked the cross-boundary path: `showcase.reset` response
  `{ epicId: string }` matches `z.object({ epicId: z.string() })` on
  the client; mocked endpoint in E2E returns the same shape.
- Confirmed `main.tsx` exposes `__tourStore` to `window` for the
  Playwright tests to call `startTour()` directly (DEV mode only —
  Playwright runs against `pnpm dev`).

## Bugs filed

| # | Severity | Summary |
|---|----------|---------|
| 1 | HIGH | `ShowcaseButton` confirmation modal missing focus management (no initial focus, no trap, no Escape, no focus return) |
| 2 | HIGH | `TourOverlay` missing arrow-key navigation required by spec |
| 3 | HIGH | `TourOverlay` does not restore focus to the triggering element on dismiss |
| 4 | HIGH | `TourOverlay` declares `aria-modal="true"` but `pointer-events: none` on backdrop contradicts modal semantics |
| 5 | HIGH | Phase 11 walkthrough screenshots missing (`assets/screenshots/phase-11/` contains only `.gitkeep`) |
| 6 | HIGH | Capstone E2E does not verify audio playback as required by spec |

## INFORMATIONAL notes (not bugs)

- **Tour overlay is narrative, not driving the showcase.** The
  `SHOWCASE_STEPS` list defines `route`, `title`, `body`, and an
  optional anchor selector, but contains no actions (dispatch, respond
  to PAUSED_INPUT, equip skill). The task spec's acceptance criterion
  #5 ("the user actually clicks Dispatch, picks JWT library at
  PAUSED_INPUT, equips type_whisperer at re-post") is interpreted as
  *user-driven* interaction — the tour just navigates and narrates.
  This matches the spec wording ("Each step has a 'Next' button. The
  tour can be exited at any time.") but is worth flagging: a fresh user
  reaching step 4 will see an empty active-quest list unless they go
  back and click Dispatch themselves, which the narrative doesn't
  instruct them to do. Consider adding an explicit per-step action
  prompt in a follow-up.
- **`closeBtnRef` declared in `tour-overlay.tsx` but never referenced
  programmatically.** It's only attached to the close button — no
  logic reads it. Cosmetic; could be removed. Not worth a bug round.
- **Stub adapter routes by string match on `questId`.** The repost
  variant is matched by `questId.startsWith('quest-showcase-jwt')`
  *after* the exact match for `quest-showcase-jwt`. Correct, but
  fragile if future test fixtures use other IDs sharing the prefix —
  consider explicit `quest-showcase-jwt-v2` / `quest-showcase-jwt-repost`
  branches. Test coverage already locks this in.
- **`isDemoMode()` is re-evaluated on every render.** Cheap (reads
  `window` and an env constant), so no real cost; just noting it isn't
  memoized.
- **Cross-boundary check on stub adapter `monsterTypeId` values
  (`goblin_linter`, `imp_typecheck`, `lich_repeated_failure`)** — these
  are the same IDs used in earlier phases' fixtures/migrations; no
  enum/CHECK constraint mismatch found.

## Capstone Coverage check (per `.claude/rules/review-contract.md`)

Per the contract for the last task of a phase, the reviewer must verify
that every feature built in this phase is reachable from the app's
entry point.

- Town Square ✓ entry point reachable at `/town/town-square`
- Start Showcase Demo button ✓ rendered in `QuestBoardPanel` (visible
  only in demo mode)
- Tour overlay ✓ mounted at top of `App` (above `Routes`), portal
  target `#tour-portal` is in `index.html`
- The tour navigates to: town-square, war-room, armory, quest scenes
  (`/quest/quest-showcase-{copy,meter,jwt}`), hall-of-returns, library
  — all of which correspond to existing Phase 1–10 routes.

There is one capstone-coverage concern that overlaps with bug #6 and
the INFORMATIONAL note above: the tour *navigates* to each Phase 1–10
surface but does not *exercise* it. The human has to drive the
dispatch / respond / equip actions themselves while the narrative
plays. The spec allows this, but it means the "one button → full
vision" promise depends on the human being attentive.

## Verdict

**FAIL** — 6 HIGH-severity bugs filed.

All bugs are accessibility / spec-completeness issues, not broken
functionality. Tests, lint, typecheck, and the cross-boundary contract
are all clean. The fixer should address bugs 1–4 (a11y) in code, bug 5
(screenshots) by either capturing them or downgrading the spec, and
bug 6 (audio assertions) by either adding the spy or filing a
follow-up task.

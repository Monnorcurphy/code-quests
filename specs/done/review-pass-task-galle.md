# Review Pass — Task galle (Hall of Returns view + failure summaries)

**Branch:** `feature/galle` (parent: `feature/el-morro`)
**Verdict:** FAIL — 5 bugs filed (2 HIGH, 3 LOW), 0 CRITICAL.

## Checks performed

- Read task spec at `metrics/task-galle-context.md`.
- Read the pre-computed diff (16 files, 1,216 inserts).
- Read every changed source file (server route, client feature, detail subcomponent, store, scene, HUD manager, API layer, CSS, tests).
- Ran `pnpm typecheck` — clean.
- Ran `pnpm lint` — clean.
- Ran `pnpm test` — 321 tests pass.
- Ran the new Hall of Returns suite directly (`pnpm vitest run src/__tests__/hall-of-returns.test.tsx`) — 18 tests pass, no `validateDOMNesting` warnings emitted by React.
- Grepped for hardcoded secrets (`sk-`, `AKIA`, `api_key`, `password=`) — none.
- Verified the new `/quests/returned` route ordering: `GET /returned` is registered before `GET /:id`, so `:id` does not shadow `returned` (verified by reading `packages/server/src/routes/quests.ts`).
- Verified cross-boundary contract for `ReturnedQuest`:
  - Server `rowToApi` and the augmented `adventurer` / `agent` shape match the client Zod schemas in `packages/client/src/lib/api.ts`.
  - DB CHECK constraints for `status` already include `'complete'` and `'failed'` (consumed by the route's `WHERE status IN (...)`).
  - `FailureSummaryRecommendation` enum values used in the UI (`retry`, `repost_with_clarification`, `retire`) match the shared schema.
  - The new migration `004_agent_events.sql` adds `events_json TEXT NOT NULL DEFAULT '[]'` — the route reads it with a `?? '[]'` fallback and the client parses entries via `AgentEventSchema`.
- Verified that `HallOfReturnsScene` registers `'hall-of-returns'` as the active modal on enter and clears it on shutdown — `all-buildings.test.ts` covers this.
- Verified the HUDOverlayManager routes `'hall-of-returns'` to the new feature panel; the old `COMING_SOON_CONTENT` map is now empty (correct, since the only entry was Hall of Returns).
- Confirmed the spec's instruction "no no-op buttons for unimplemented features" is followed — the detail view uses a `<p>` "coming in Phase 9" note, not a disabled button.

## Findings

### HIGH (2)
1. **review-1.md** — Missing axe-core E2E coverage for the populated Hall of Returns view AND the detail modal. The acceptance criteria explicitly requires axe-core checks on both, but the existing e2e test only exercises the empty/error state via the (now misleadingly named) `PLACEHOLDER_BUILDINGS` loop.
2. **review-2.md** — Opening the detail view does not move focus to the Back button. There is an effect that handles detail → list, but no inverse effect for list → detail; focus is dropped to `document.body`, defeating the focus-trap.

### LOW (3)
3. **review-3.md** — `QuestCard` renders `<div>`, `<p>`, and `<ul>` inside a single `<button>`. Invalid HTML; the inner list's `aria-label` semantics are not exposed to screen readers because the parent is a single button control.
4. **review-4.md** — `ReturnedQuestDetail` uses `role="alert"` on a static historical failure block. This re-announces on every mount and is not the intended use of the alert role.
5. **review-5.md** — The card's Victory/Defeat badge is `aria-hidden="true"` and the button's `aria-label` does not include the outcome. Screen-reader users navigating directly to a card get no outcome cue — only the column heading provides context.

## INFORMATIONAL notes (no bug filed)

- **E2E `PLACEHOLDER_BUILDINGS` naming.** `all-buildings.spec.ts` still classifies `hall-of-returns` as a placeholder. The existing tests happen to keep passing because the new dialog still has the heading "Hall of Returns" and still closes on Escape, but the naming is misleading. Bug review-1 covers moving it out and adding real coverage; the existing tests should be renamed/relocated at the same time.
- **Adventurer source on quest cards.** The `/quests/returned` query derives the adventurer via the latest agent's `adventurer_id`, not the quest's own `adventurer_id`. For quests that were manually marked `complete`/`failed` without spawning an agent, the card shows no adventurer name (covered by the "no agent" test). Matches the spec's "joined with their agent and adventurer for display" intent; flag if Phase 9 broadens this.
- **`return-detail-log` is rendered as `<ol>` despite `className="return-detail-log"` and an `aria-label="Quest event log"`.** That's a fine choice (events are ordered), but make sure the screen-reader announcement of ordinal numbers ("1, 2, 3 …") does not feel like noise when the visible content has its own timestamps. Consider switching to an unordered list if the numbering is not meaningful.
- **`role="dialog"` vs `role="alertdialog"`** — the modal correctly uses `dialog` and labels it via `aria-labelledby="hall-of-returns-title"`. No issue, just noting consistency with other Phase 4 panels.

## Verdict

**FAIL.** 5 bugs filed in `specs/bugs/review-1.md` through `review-5.md`. None are CRITICAL; build, typecheck, lint, and the entire test suite pass. The two HIGH findings (missing axe-core coverage of the new surfaces, and missing focus management on detail open) are accessibility regressions against the task's explicit acceptance criteria. The three LOW findings are semantic / ARIA hygiene issues that should be fixed in the same round.

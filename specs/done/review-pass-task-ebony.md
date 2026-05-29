# Review Pass — TASK ebony (post-mortem panel)

**Branch:** `feature/ebony`
**Parent:** `feature/cedar`
**Verdict:** FAIL — 1 HIGH + 1 LOW bug filed

## Checks performed

- Read the pre-computed diff (10 files, 932 insertions, 17 deletions).
- Read all new/modified source files: `post-mortem.tsx`, `combat-log-replay.tsx`, `failure-summary-card.tsx`, `feedback-form.tsx`, `use-post-mortem.ts`, `app.tsx`, `lib/api.ts`.
- Read both new test files end-to-end (`feedback-form.test.tsx`, `post-mortem.test.tsx`).
- Cross-referenced shared schemas: `MonsterEncounterSchema`, `FailureSummarySchema`, `FeedbackBodySchema`, `FeedbackEntrySchema`, `FatalMonsterSchema`, `PostMortemResponseSchema`.
- Cross-referenced backend handler `POST /quests/:id/actions/feedback` in `packages/server/src/routes/quest-actions.ts` and the shared `validate` middleware to confirm field-name parity and `{ error, field }` error envelope.
- Ran the full client test suite: `pnpm --filter @code-quests/client test -- --run` → 851/851 passing.
- Ran `pnpm --filter @code-quests/client lint` → clean.
- Ran `pnpm --filter @code-quests/client typecheck` → clean.
- Grepped for `console.*`, secrets (`sk-`, `AKIA`, `api_key=`, `password=`), and dead/TODO markers under `packages/client/src/features/hall-of-returns/` → none found.
- Verified the new route in `app.tsx:15` and confirmed `ReturnedQuestList` navigates to `/hall-of-returns/${questId}` (`returned-quest-list.tsx:109`).

## Cross-boundary validation

- **Feedback body:** Frontend `api.quests.submitFeedback(id, text)` → `POST /quests/:id/actions/feedback` with body `{ text }`. Backend `FeedbackBodySchema = z.object({ text: z.string().min(1).max(2000) })`. Field name and 1–2000 char bound match on both sides. ✓
- **Recommendation enum:** `failure-summary-card.tsx`'s `RECOMMENDATION_LABELS` covers all five variants in `FailureSummaryRecommendationSchema` (`retry`, `repost_with_clarification`, `retire`, `break_into_smaller`, `level_up_first`) with a string-fallback safety net. ✓
- **Encounter outcome:** `OUTCOME_LABELS` covers all three `MonsterEncounter.outcome` enum variants (`victory`, `defeat`, `escape`). ✓
- **Difficulty stars:** `★`.repeat(difficulty) + `☆`.repeat(5 - difficulty) is safe because `MonsterEncounterSchema.difficulty` is `int().min(1).max(5)`; Zod parses the response before render, so `repeat()` cannot receive a negative integer.
- **Error envelope:** Server returns `{ error, field }` (validated by `ApiErrorBodySchema` in `lib/api.ts`). `FeedbackForm`'s `onError` correctly handles both the `ApiError` field-error path and the bare `Error` fallback.
- **Quest status:** `PostMortem` accepts any `QuestStatusSchema` value via passthrough, so any future status added to the enum will not crash this screen.

## Bugs filed

- `specs/bugs/review-1.md` — **HIGH:** Missing axe-core e2e coverage for `/hall-of-returns/:questId`. Spec requires "Axe-core scan: zero violations"; `packages/client/tests/e2e/hall-of-returns.spec.ts` only covers the list/legacy dialog, not the new post-mortem route.
- `specs/bugs/review-2.md` — **LOW:** Back-button focus `useEffect` runs on mount before the back button is rendered (it lives in the success branch, not in `LoadingState`), so the developer-intended focus-on-load never fires on a fresh visit. Fix is a one-shot focus effect keyed on `data`.

## Informational notes (not bugs)

1. **No CSS for new selectors.** `post-mortem-*`, `combat-log-*`, `failure-summary-*`, `failure-rec-badge--*`, `feedback-form-*`, and `feedback-char-counter` are referenced by the JSX but have no rules in `packages/client/src/styles/features.css` or `global.css`. Semantic HTML still renders correctly, and TASK cedar shipped its components without styles too — so this appears to be a phase-wide pattern that will land in the phase capstone or a follow-up theming task. Worth confirming before the phase ends interactable.

2. **Fatal-monster link is non-specific.** `failure-summary-card.tsx:64` links to `/town/library`. The spec phrases this as "links back to bestiary entry from Phase 6" — i.e., the specific monster's entry. Bestiary deep-linking isn't implemented yet in Phase 6, so the generic library link is a reasonable interim placeholder, but it's worth filing as a follow-up when bestiary deep-links land.

3. **`combatLog: z.array(z.unknown())` rendered with `String(line)`.** If an entry is ever a non-string object, this prints `"[object Object]"`. Today's encounter producers emit strings only and the schema is shared with prior tasks, so this isn't a regression — but tightening the array element type to `z.string()` (or rendering with `typeof line === 'string' ? line : JSON.stringify(line)`) would future-proof the panel.

4. **`MemoryRouter` wrapper in `FeedbackForm` tests is unused.** `FeedbackForm` doesn't import anything from `react-router-dom`. Harmless; could be dropped to slim the test setup.

5. **Recommendation badge colour relies on a class name (`failure-rec-badge--${recommendation}`).** Since no CSS exists yet (see note 1), the visual distinction is currently the textual label only — which actually satisfies the "color is not the only indicator" rule. When the CSS lands, ensure the label remains visible (don't replace text with colour-only chips).

## Final verdict

**FAIL** — 1 HIGH (missing axe-core e2e coverage) and 1 LOW (mount-focus effect ineffective) filed. Fix and re-verify.

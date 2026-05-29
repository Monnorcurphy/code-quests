# Progress — Phase 9

Previous task progress archived to metrics/progress-before-ebony.md

## TASK ebony — Post-mortem panel (frontend)

**Status:** DONE

**What was built:**
- `use-post-mortem.ts` — TanStack Query hook for `GET /hall-of-returns/quests/:id/post-mortem`; invalidates on `quest_feedback_added` WebSocket event
- `combat-log-replay.tsx` — semantic `<ol>` of `MonsterEncounter` rows; each row shows sprite, name, difficulty stars, outcome badge, and collapsible combat-log detail lines
- `failure-summary-card.tsx` — shows `notes`/`reason`, `retries`, recommendation badge (styled per recommendation type), and fatal monster with bestiary link
- `feedback-form.tsx` — textarea with visible label, char counter (0/2000), submit disabled until ≥1 char, 3 mutation states (loading / success-toast auto-dismiss / error-persistent), field-named error messages
- `post-mortem.tsx` — main page at `/hall-of-returns/:questId`; loading, 404, and server-error states; back button restores hall-of-returns modal via `useTownStore`; `prefers-reduced-motion` class applied
- `app.tsx` — replaced redirect for `/hall-of-returns/:questId` with real `<PostMortem />` route
- `api.ts` — added `PostMortemResponseSchema`, `api.hallOfReturns.getPostMortem`, `api.quests.submitFeedback`
- Tests: `__tests__/post-mortem.test.tsx` (12 tests), `__tests__/feedback-form.test.tsx` (14 tests)

**Verify:**
- 851 tests pass, 0 failures
- TypeScript: clean
- ESLint: clean

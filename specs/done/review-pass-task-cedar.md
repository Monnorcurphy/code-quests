# Review Pass — TASK cedar (Hall of Returns view + returned-quest list)

**Branch:** `feature/cedar`
**Parent:** `feature/catalpa`
**Verdict:** **FAIL — 3 bugs filed (1 HIGH, 2 LOW)**

## Scope reviewed

- `packages/client/src/features/hall-of-returns/hall-of-returns.tsx` (new — tabbed shell)
- `packages/client/src/features/hall-of-returns/returned-quest-list.tsx` (new — list + rows)
- `packages/client/src/features/hall-of-returns/use-returned-quests.ts` (new — TanStack Query + WS invalidation)
- `packages/client/src/features/hall-of-returns/__tests__/returned-quest-list.test.tsx` (new)
- `packages/client/src/features/hall-of-returns.tsx` (now a one-line re-export shim)
- `packages/client/src/__tests__/hall-of-returns.test.tsx` (rewritten for the new shape)
- `packages/client/src/lib/api.ts` (added `api.hallOfReturns.listQuests` + Zod schemas)
- `packages/client/src/app.tsx` (added `/hall-of-returns/:questId` Navigate placeholder)
- `packages/client/src/components/hud-overlay-manager.tsx` (import path updated)
- `progress.md` (task notes appended)

## Checks performed

| Check | Result |
|---|---|
| `pnpm -C packages/client typecheck` | ✅ pass |
| `pnpm -C packages/client lint` | ✅ pass (zero warnings) |
| `pnpm -C packages/client test --run` | ✅ 825/825 tests pass across 57 files |
| Hardcoded secrets (`sk-`, `AKIA`, `api_key`, `password=`) | ✅ none |
| Cross-boundary check: tab values `returned_to_town` / `complete` vs server `ListQuerySchema` (`packages/server/src/routes/hall-of-returns.ts:11-15`) vs DB enum (`packages/shared/src/quest.ts:57-66` — `QuestStatusSchema`) | ✅ aligned on all three layers |
| Cross-boundary check: Zod `HallOfReturnsListSchema` / `HallOfReturnsQuestSchema` (`packages/client/src/lib/api.ts:204-229`) vs server response shape (`packages/server/src/routes/hall-of-returns.ts:135-146`) | ✅ matches (items, nextCursor, fatalMonster shape, failureSummary nullable) |
| Cross-boundary check: WebSocket event types consumed in `use-returned-quests.ts` (`quest_returned`, `quest_retired`, `quest_reposted`, `quest_split`, `quest_feedback_added`) vs `AgentEventSchema` discriminated union (`packages/shared/src/agent.ts:83-111`) | ✅ all five exist |
| Empty / loading / error states | ✅ all three rendered (note: loading state has no visible CSS — filed as `review-1.md`) |
| Accessibility: dialog `role`+`aria-modal`+`aria-labelledby`, tablist `role="tablist"`, tabs `aria-selected`, tabpanels `role="tabpanel"`+`aria-labelledby`, row `aria-label` includes title, `<time dateTime>`, `<img alt="">` + `aria-hidden` (decorative monster sprite), `aria-live="polite"` + `aria-busy` on loading list, `role="alert"` on error banner | ✅ semantically correct (visual styling is a separate issue — see `review-1.md`) |
| Color-only indicators | ✅ recommendation badge has text label (no color-only signal) |
| Focus management: close button focused on mount, focus trap via `useFocusTrap` | ✅ |
| Status enum: spec says `completed`, DB enum is `complete` — implementation uses `complete` and matches DB | ✅ correct (spec wording was inaccurate, code is right) |

## Filed bugs

| # | Severity | Title |
|---|---|---|
| `review-1.md` | HIGH | Hall of Returns new components have no CSS — tabs, rows, badges, and skeleton placeholders are unstyled |
| `review-2.md` | LOW  | `QuestRow` onKeyDown handler double-fires navigation on Enter |
| `review-3.md` | LOW  | Test assertions use `toBeDefined` on `querySelector` / `getElementById` — pass even when element is missing |

## INFORMATIONAL notes

1. **Placeholder `/hall-of-returns/:questId` route is a temporary dead-end.** Per the comment in `app.tsx`, this route is owned by TASK ebony. Right now clicking a row navigates to `/hall-of-returns/quest-1`, which immediately redirects to `/town/hall-of-returns`. Because `useTownStore` keeps `activeModal === 'hall-of-returns'` in memory, the modal pops back open — but the `?tab=...` query param is lost in the redirect, so the user is silently dropped back to the default tab. This is intentional placeholder behavior; flagged so TASK ebony's reviewer can confirm the seam is closed when the post-mortem panel ships.

2. **WebSocket invalidation only covers quests already in the list.** `use-returned-quests.ts` subscribes per-quest-id (the `subscribe(questId, ...)` API in `lib/quest-socket.ts` requires it). That means: a quest transitioning from `active` → `returned_to_town` while the user is staring at the Hall of Returns will NOT trigger an invalidation, because the client never subscribed to that quest. Realtime "new return arrived" updates would require either a separate broadcast-style channel or invalidating on a focus/visibility-change handler. Not a regression — the prior implementation had no realtime path at all — but worth a follow-up.

3. **Tab URL value `returned_to_town` is functional but not human-friendly.** The URL state preservation requirement is met (`?tab=returned_to_town` / `?tab=complete`). The values were chosen to match the DB enum directly so no mapping is needed; a future cosmetic pass could shorten them (`?tab=returned` / `?tab=complete`) without changing the underlying contract.

4. **Old `return-card` / `return-column` CSS is now dead code.** Approximately 150 lines in `packages/client/src/styles/features.css` (around lines 1398–1620) target classes the new implementation no longer renders. Fixing `review-1.md` (adding new CSS) is the natural moment to delete the old block — folded into that bug's Fix step rather than filed separately.

5. **Close button gets focus on mount, ahead of the tabs.** Matches the prior modal pattern but means a keyboard user must Tab past Close → tab buttons → first row to reach a quest. Acceptable for a modal-dismissal-safety default; flagged in case TASK ebony or a later UX pass wants to revisit.

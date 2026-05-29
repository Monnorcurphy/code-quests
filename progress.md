# Progress — Phase 9

Previous task progress archived to metrics/progress-before-alder.md

## alder — Hall of Returns API (backend)

- Created `packages/shared/src/return-actions.ts`: Zod schemas for `RepostBodySchema`, `SplitBodySchema`, `FeedbackBodySchema`, `FeedbackEntrySchema`
- Extended `FailureSummarySchema` with `splitIntoQuestIds?: string[]` (for split action)
- Extended `AgentEventSchema` with 4 new event types: `quest_reposted`, `quest_retired`, `quest_split`, `quest_feedback_added`
- Created `packages/server/src/routes/hall-of-returns.ts`: `GET /hall-of-returns/quests` (cursor-paginated, status filter) + `GET /hall-of-returns/quests/:questId/post-mortem` (full hydration payload)
- Created `packages/server/src/routes/quest-actions.ts`: `POST /quests/:id/actions/{repost,retire,split,feedback}` with full validation, state guards, and WebSocket events
- Mounted both routers in `packages/server/src/index.ts`
- Created integration tests: `hall-of-returns.test.ts` (17 tests) + `quest-actions.test.ts` (21 tests)
- All 461 server tests pass; typecheck + lint clean

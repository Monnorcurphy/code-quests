# Review Pass — task el-morro

**Branch:** `feature/el-morro`
**Parent:** `feature/edinburgh`
**Verdict:** FAIL — 1 HIGH + 1 LOW filed.

## Checks performed

- Read pre-computed diff (10 files, +865/-34).
- Read spec at `metrics/task-el-morro-context.md` once.
- Read all changed source files: `active-quest-panel.tsx`, `cancel-button.tsx`, `use-active-quest.ts`, `town-square.tsx`, `war-room.tsx`, `lib/api.ts`, `town-store.ts`.
- Read supporting files for boundary checks: `lib/quest-socket.ts`, `lib/use-focus-trap.ts`, `components/hud-overlay-manager.tsx`, `routes/quests.ts` (cancel + active endpoints).
- `pnpm --filter @code-quests/client test`: **301 / 301 pass** (27 test files).
- `pnpm --filter @code-quests/client typecheck`: clean.
- `pnpm --filter @code-quests/client lint`: clean.
- `checks/contrast-classes.sh`: no banned Tailwind classes.
- `checks/motion-reduce.sh`: all animations have reduced-motion guards.
- `checks/conditional-assertions.sh`: no conditional assertions.
- `checks/empty-catch.sh`, `error-handling.sh`: no new violations in changed files.
- Secret scan (`sk-`, `AKIA`, `api_key`, `password=`) in changed files: clean.
- `console.*` in changed files: clean.
- Cross-boundary review: `api.quests.cancel` calls `POST /quests/:id/cancel` (returns `Quest`), and `api.quests.list` / `api.quests.get` schemas match `QuestSchema` parsing on the client. The `/quests/active` endpoint returns `Quest & { agent }` shape, but is not used by this task (see INFO-1 below). Modal name `'draft'` triggers the War Room (confirmed via `hud-overlay-manager.tsx:55`).

## Bugs filed

- `specs/bugs/review-1.md` — **HIGH** — Escape on the cancel confirm dialog also closes the parent War Room modal because both `useFocusTrap` instances register independent document-level keydown listeners.
- `specs/bugs/review-2.md` — **LOW** — heading hierarchy skips `h2 → h4` in the War Room active-quest branch (no intervening `h3`).

## Informational notes (no bug filed)

- **INFO-1 — Spec deviation: peek uses `/quests` not `/quests/active`.** The spec for the Town Square peek says "read from `GET /quests/active`". The implementation in `town-square.tsx:62-65` uses `api.quests.list` and filters client-side for `status === 'active'`. Functionally equivalent today (the same TanStack Query key `['quests']` is invalidated on dispatch and cancel, so the peek updates correctly), but a future change to the server-side `/quests/active` shape — which already includes joined agent info — would not flow through. Consider switching to `api.quests.active` once a typed schema is added for the `{...quest, agent}` shape returned by that endpoint.

- **INFO-2 — Cancel button rendered for non-active in-progress states.** `war-room.tsx:75` shows `<CancelButton>` for `active | paused_input | user_blocked`, but the backend `POST /quests/:id/cancel` (routes/quests.ts:468) returns 409 "Only active quests can be cancelled" for non-active statuses. The UI surfaces this as an error toast, which is recoverable, but a cleaner approach would be to either (a) only render `CancelButton` when `quest.status === 'active'` to match the spec exactly, or (b) loosen the backend to allow cancelling paused/blocked quests. Either is a future call.

- **INFO-3 — Active-quest error copy assumes server-down cause.** `active-quest-panel.tsx:75` says "Could not load quest. Make sure the server is running." A 404 (quest not found) shows the same message, which is misleading. Consider distinguishing by inspecting the error type.

- **INFO-4 — `key={i}` on event list items.** `active-quest-panel.tsx:101-103` keys events by array index. Acceptable for an append-only feed that is never reordered, but `event.timestamp + event.type` would be more idiomatic React.

## Boundary contract validation

- Migration enum `quests.status` allows `idle | active | paused_input | user_blocked | complete | failed` — all six are handled in `war-room.tsx` and in `Quest['status']` via shared schema. ✓
- `AgentEventSchema` discriminated union (`progress | combat | status_change | completed | failed | log`) — all six branches handled exhaustively in `formatEvent` (active-quest-panel.tsx:5-25). TypeScript would catch any drift; no runtime gap. ✓
- WebSocket subscribe → backend `quest-channel` → frontend `subscribe(questId, onEvent)` is unchanged in this task and validated by `AgentEventSchema.safeParse` at the boundary (quest-socket.ts:46). ✓

## Final verdict

**FAIL** — 1 HIGH + 1 LOW bug filed. The HIGH (review-1) is a real UX/accessibility regression caused by two unrelated focus traps stacking their Escape handlers on `document`. Tests pass because no test exercises Escape on the inner dialog. The LOW (review-2) is a small a11y hygiene issue.

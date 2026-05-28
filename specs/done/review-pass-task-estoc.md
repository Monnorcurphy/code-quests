# Review pass — task estoc (WebSocket subscription + live event-to-scene wiring)

## Verdict: FAIL — 3 bugs filed (1 HIGH, 2 LOW)

## Checks performed

- Ran `pnpm --filter @code-quests/client test` — 400/400 passing.
- Ran `pnpm lint` — clean (0 errors / 0 warnings).
- Ran `pnpm typecheck` — clean across shared / client / server.
- Read each touched source file once: `quest-socket.ts`, `quest-store.ts`, `use-quest-stream.ts`, `combat-log.tsx`, `hud-overlay.tsx`, `quest.tsx`, `logger.ts`, and their tests.
- Cross-checked the realtime contract end-to-end:
  - Client `wsUrl()` uses `window.location.host` + path `/realtime`. Server `attachQuestChannel(...)` mounts `WebSocketServer({ server, path: '/realtime' })`. ✅
  - Client sends `{ type: 'subscribe', questId }`. Server `ClientMessageSchema` accepts `{ type: 'subscribe' | 'unsubscribe', questId }`. ✅
  - Schema validation lives on both ends (`AgentEventSchema.safeParse` on client; `ClientMessageSchema` on server). ✅
- Verified `QuestSceneKey` shared schema matches client `QUEST_SCENE_KEYS` exactly. ✅
- Verified `sceneRouter.goToScene(...)` honours `prefers-reduced-motion` (data-attribute or media query) — spec requirement met for fade. ✅
- Grepped for `console.log|console.warn|console.error` in production source — only inside `logger.ts` (gated behind `import.meta.env.DEV` with explicit ESLint disable, as the spec instructs). ✅
- Grepped for hardcoded secrets (`sk-`, `AKIA`, `api_key`, `password=`) — none. ✅
- Verified the test file uses unconditional assertions (no `if (...) expect(...)` patterns). ✅
- Verified `vi.useFakeTimers()` paired with `vi.useRealTimers()` in afterEach. ✅
- Verified the `combat-log` container exposes `role="log"`, `aria-label`, `aria-live="polite"`, `aria-atomic="false"`. ✅
- Verified the connection-status chip has a visible text label (`Live` / `Offline` / `Reconnecting…`) in addition to colour — accessibility rule 3 met. ✅
- Verified the existing `subscribe()` API plus the new `connectQuestSocket()` API both exist; the spec's `connectQuestSocket` returns `{ close }` rather than an `AsyncIterable<AgentEvent>` — see informational note below.

## Bugs filed

1. **review-1.md (HIGH)** — `completed` / `failed` outcomes never reach the HUD. Both client (`use-quest-stream`) and combat log filter ignore those event types and the server runner does not emit a paired `status_change`. Spec acceptance (d) violated.
2. **review-2.md (LOW)** — `CombatLog` uses array index as React key. Once the 200-entry cap kicks in, every append shifts indices, so the index→entry mapping React relies on becomes incorrect.
3. **review-3.md (LOW)** — `parseError` is set but never cleared on subsequent valid events or `questId` change. The error chip latches on and survives navigation between quests.

## Informational notes (not bugs)

- **Real `ws` server in tests:** the spec says "Use a real `ws` server in the test (no mock — boot a small WebSocketServer in the test setup)." `quest-socket.test.ts` stubs the global `WebSocket` with an in-process `FakeWebSocket` instead. Coverage is comprehensive (schema validation, reconnect, dispose, cap on backoff), and the same pattern is already in use for the pre-existing `subscribe()` API from the previous task, so this is treated as a documentation/spec-prescription mismatch rather than a functional gap. Worth revisiting alongside the existing `subscribe()` tests in a future cleanup.
- **`connectQuestSocket` return shape:** spec describes `{ close(): void; events: AsyncIterable<AgentEvent> }`; implementation exposes a callback-based API (`onEvent`, `onConnectionChange`, `onParseError`) with `{ close }`. The callback shape is what the rest of the hook actually needs and matches the React lifecycle better — flagging as INFO so future work explicitly picks one shape (current code is consistent and tested).
- **Empty-state copy in combat log:** "Combat log will appear here" is fine but doesn't follow the "what do I do next" UX-principle guidance. Acceptable for a passive log surface; revisit if the surface evolves into something users can interact with.
- **`text-gray-100`/`-200`/`-300` on combat-log entries:** flagged by the contrast safelist but used against the dark `rgba(20,12,5,0.75)` HUD background where the ratio passes WCAG AA. Consistent with existing HUD styling (e.g. `AdventurerName`), so not filed as a bug.

# Phase 4 Complete

**Branch:** feature/golconda  
**Tasks:** agra-fort → akershus → cartagena → castillo-de-san-marcos → edinburgh → el-morro → galle → golconda

## What shipped

| Task | Feature |
|---|---|
| agra-fort | `AgentAdapter` v2 interface (`spawn()`, `AgentHandle`); `agents-service.ts` lifecycle CRUD; offline adapter extended |
| akershus | WebSocket channel at `/realtime`; `quest-socket.ts` browser wrapper with auto-reconnect |
| cartagena | Claude Code subprocess adapter (`cc-adapter.ts`); MCP config wiring; stream-JSON parsing |
| castillo-de-san-marcos | Auto-match service; adventurer selection by class + specialization; dispatch integration |
| edinburgh | `quest-runner.ts`; `POST /quests/:id/{complete,fail,cancel}`; `GET /quests/active` |
| el-morro | `ActiveQuestPanel` with live WebSocket feed; `CancelButton` with confirm dialog; Town Square peek |
| galle | `HallOfReturns` view replacing Phase 2 placeholder; `ReturnedQuestDetail` modal; `GET /quests/returned` |
| golconda | Capstone: seed extensions, Town Square returned-quests badge, Playwright E2E specs |

## Adapter coverage

- **Offline adapter** (default): deterministic 4-event sequence; no API key required; all tests pass
- **Claude Code adapter**: requires `CODE_QUESTS_USE_REAL_AGENT=1` + `claude` on PATH or `CODE_QUESTS_CLAUDE_BIN`; spawns real subprocess; not required for tests or demo

## Passing conditions met

- `pnpm install && pnpm build && pnpm test && pnpm lint && pnpm typecheck` all green
- `AgentAdapter.spawn()` implemented in offline + CC adapters
- `agents` table CRUD exposed via `agents-service.ts`
- WebSocket at `/realtime` fans events only to matching subscribers
- Dispatch auto-matches when `adventurerId` is unset
- Terminal endpoints (`complete`, `fail`, `cancel`) guard transitions
- Status terminal value is the literal `complete` on every layer
- Hall of Returns replaces Phase 2 placeholder
- Playwright capstone + cancel specs use offline adapter (no real network)
- Axe-core: zero violations on all new surfaces
- No `console.log` in production source; no forbidden Tailwind contrast classes

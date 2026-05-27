# Review Pass — TASK akershus (WebSocket realtime channel)

**Verdict:** PASS with 1 LOW bug filed.

## Checks Performed

- Read the diff for all 9 changed files (server + client + tests + lockfile).
- Read the task spec at `metrics/task-akershus-context.md`.
- Read the four new source files in full:
  `packages/server/src/realtime/quest-channel.ts`,
  `packages/server/src/index.ts`,
  `packages/client/src/lib/quest-socket.ts`,
  `packages/client/src/lib/logger.ts`.
- Read both new test files in full.
- Confirmed `AgentEventSchema` (`packages/shared/src/agent.ts`) is the schema
  used at both boundaries (server publish, client receive).
- Ran `pnpm -r test` — 475 tests passing (shared 58, server 140, client 277).
- Ran `pnpm -r lint` — clean across all three packages.
- Ran `pnpm -r typecheck` — clean.
- Ran `pnpm -r build` — clean.
- Grep'd new files for secret patterns (`sk-`, `AKIA`, `api_key=`,
  `password=`) — none.
- Grep'd new files for raw `console.` calls — none (the logger uses
  `console.warn` under a scoped `eslint-disable`, which is the documented
  escape).

## Cross-Boundary Validation

- Client→server protocol: `{ type: 'subscribe' | 'unsubscribe', questId }`.
  Server's `ClientMessageSchema` validates this exact shape; unknown
  message types are rejected with an error frame and tested.
- Server→client payload: `AgentEvent` (Zod discriminated union of
  `progress | combat | status_change | log | completed | failed`). Client
  re-validates every frame via `AgentEventSchema.safeParse` before invoking
  the consumer callback.
- No mismatched constants — `LOOPBACK_IPS` is server-only; `BACKOFF_*`
  constants are client-only.

## Spec Acceptance Criteria

- `attachQuestChannel()` upgrades on the shared HTTP server. ✓
- `publishQuestEvent` only reaches subscribed sockets; cross-quest
  isolation covered by `q1 vs q2` test. ✓
- Non-loopback rejection logic exists and is unit-tested via
  `isLoopbackAddress` (covers `127.0.0.1`, `::1`, IPv4-mapped loopback,
  LAN, and public IP). ✓ — see INFORMATIONAL #1 below.
- Client reconnects with exponential backoff after a forced server drop,
  with cap at 10 s. ✓ — three dedicated tests.
- Malformed frames are dropped (non-JSON test + invalid-event-type test). ✓
- No `console.log` in production source. ✓

## Bugs Filed

- `specs/bugs/review-1.md` — LOW — `s.readyState === 1` should use
  `WebSocket.OPEN` for readability and parity with the server.

## INFORMATIONAL Notes (not bugs)

1. **Non-loopback rejection — unit coverage only.** The
   `isLoopbackAddress` helper has comprehensive unit tests, but the
   `wss.on('connection', ...)` rejection path is not exercised end-to-end
   (because the integration tests connect from `127.0.0.1` and there is no
   easy way to fake `req.socket.remoteAddress`). The spec requirement is
   satisfied at the unit level; a future enhancement could use a mock
   `req` object or a `verifyClient`-based refactor to exercise the close
   path directly.

2. **Logger source.** The spec says "drops malformed frames after logging
   through the existing logger," but no `logger` existed in the client
   package before this task. The builder created
   `packages/client/src/lib/logger.ts` as a thin `console.warn` wrapper
   with `eslint-disable no-console`. Reasonable given the gap; future
   tasks should consolidate on this logger.

3. **Heartbeat coverage.** Server implements 30 s ping / 60 s idle
   timeout per spec, but there is no dedicated test for the ping/pong/
   idle behaviour. The spec did not enumerate a heartbeat test, so this
   is not a violation, but worth adding when the channel gets a real
   producer (cartagena/edinburgh tasks).

4. **Heartbeat timing.** Because the idle check runs on the same 30 s
   interval as the ping, idle detection actually fires at the next
   interval after the 60 s threshold — i.e. up to ~90 s after the last
   pong. Within the spec's intent ("close idle sockets after 60 s of no
   pong") but not exact; the simplest tightening would be a separate
   shorter-interval idle check.

5. **Upgrade-time rejection.** Non-loopback clients currently complete
   the WebSocket handshake and are then immediately closed with code
   1008. Functionally correct per spec, but rejecting at the upgrade
   phase (via `verifyClient` or `noServer: true` + manual
   `handleUpgrade`) would prevent any handshake bytes from going to a
   rejected client. Future hardening.

## Verdict

**PASS** — 1 LOW bug filed (`review-1.md`), no CRITICAL or HIGH issues.
All builds, tests, lint, and typecheck pass.

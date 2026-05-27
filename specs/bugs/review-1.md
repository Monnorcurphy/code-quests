# BUG: scene_change events emitted to WebSocket are never persisted to agents.events_json

**Severity:** HIGH
**File(s):** packages/server/src/services/quest-runner.ts

## Problem

In `runQuest`, every `AgentEvent` received from the adapter is pushed into the
local `collectedEvents` array and later persisted to `agents.events_json` via
`persistEvents()` (so the Hall of Returns can replay it). However, the new
`scene_change` events that the runner synthesises locally are sent to
`publishEvent()` (the WebSocket channel) but are **never** added to
`collectedEvents`.

Locations:

- `packages/server/src/services/quest-runner.ts:73-87` — heuristic-driven
  scene_change inside the `progress` branch.
- `packages/server/src/services/quest-runner.ts:89-100` — completion-driven
  scene_change loop inside the `completed` branch.

Effect:

- Live (active-quest) view via WebSocket: shows scene_change events.
- Historical (Hall of Returns) view: **does not** show scene_change events,
  because `returned-quest-detail.tsx` reads `quest.agent.events` from the DB.

The Builder explicitly added a `case 'scene_change':` formatter to
`returned-quest-detail.tsx` (the historical viewer), clearly expecting these
events to appear there — so this is broken behaviour, not a documented omission.

## Expected

- All `AgentEvent`s flowing through `publishEvent()` should also be persisted to
  `agents.events_json` so that the historical (Hall of Returns) and live views
  agree on the event log.
- The acceptance criteria say "scene_change events flow through the existing
  WebSocket pipeline" — they should also flow into the persisted log, given the
  Builder updated `returned-quest-detail.tsx` to render them.

## Fix

In `packages/server/src/services/quest-runner.ts`, when constructing each
synthesised `scene_change` event, push it onto `collectedEvents` before (or
right after) calling `publishEvent`. For example:

```ts
const sceneEvent: AgentEvent = {
  type: 'scene_change',
  timestamp: new Date().toISOString(),
  from: transition.from,
  to: transition.to,
};
collectedEvents.push(sceneEvent);
publishEvent?.(quest.id, sceneEvent);
```

Apply this in both the `progress` branch (heuristic transition) and the
`completed` branch (terminal transition loop).

Add a regression test in
`packages/server/src/__tests__/quest-runner.test.ts` that:

1. Spawns an adapter that emits enough progress events to trigger at least one
   scene_change, then a `completed` event.
2. After `done` resolves, reads `agents.events_json` and asserts that the
   persisted event array contains the expected `scene_change` entries with
   matching `from`/`to`.

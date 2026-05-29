# Review Pass — TASK extratropical-cyclone

**Branch:** `feature/extratropical-cyclone`
**Parent:** `feature/electrical-storm`
**Verdict:** FAIL (4 bugs filed: 2 HIGH, 2 LOW)

## Checks performed

- Read the task spec (`metrics/task-extratropical-cyclone-context.md`).
- Read the full diff of the 8 changed files.
- Reviewed `quest-store.ts`, `use-quest-stream.ts`, `base-quest-scene.ts`, `player.ts` source files.
- Reviewed test files: `quest-store.test.ts`, `use-quest-stream.test.tsx`, `quest-scenes.test.ts`.
- Cross-checked types in `packages/shared/src/quest.ts` and `agent.ts` against client consumers.
- Ran `pnpm -C packages/client test` — 587/587 pass.
- Ran `pnpm -C packages/client lint` — clean.
- Ran `pnpm -C packages/client typecheck` — clean.
- Ran `pnpm -C packages/shared test` — 83/83 pass.
- Grepped client diff for hardcoded secrets (`sk-`, `AKIA`, `api_key=`, `password=`) — none found.
- Grepped changed source files for `console.*` — none found in production source (test files only, which is fine).
- Inspected cross-boundary contract: `InputRequestSchema` / `UserBlockerSchema` / `QuestStatusSchema` (server) vs. usage in client store & event handlers — schemas align (paused_input event fields, status enum members match).
- Verified capstone coverage requirement does not apply (this is the 5th of 7 tasks in phase 7; capstone is `gustnado`).

## Bugs filed

| # | Severity | Title |
|---|----------|-------|
| review-1 | HIGH | REST hydrate path does not populate inputRequest / userBlocker / status in quest store |
| review-2 | HIGH | Player can move and re-trigger animation during scene freeze |
| review-3 | LOW | Double-fetch of quest on status_change → user_blocked |
| review-4 | LOW | Reduced-motion tests leave `window.matchMedia` set to undefined |

## Informational notes (not bugs)

- **Store subscription is non-selective:** `BaseQuestScene` calls `useQuestStore.subscribe((state) => ...)` which fires on every store mutation (every event append, every encounter change, etc.), not just status changes. Correctness is preserved by the early return in `_applyFreezeState`, but each event causes a callback. Could be tightened later with Zustand's `subscribeWithSelector` middleware. Phase 7 capstone or a future polish pass.
- **`paused_input` handler builds a literal with `undefined` keys:** `setInputRequest` receives `{ question, context: event.context, awaitingSince, adventureFraming: event.adventureFraming }` where `context` and `adventureFraming` may be `undefined`. JavaScript treats own-property-with-undefined the same as missing-property for property access (`obj.context === undefined`), and the tests assert `toBeUndefined()` which passes. No behavior bug — noted for awareness if downstream code ever uses `'context' in req`.
- **Dim overlay depth is `1000`, well above any existing scene element** (max in-game depth is 2). Confirmed it sits above the player sprite and combat layer monster sprite.
- **`prefers-reduced-motion` path verified end-to-end:** when matched, the dim overlay is not created and canvas opacity is set to `0.7` on freeze / `1` on resume. Spec acceptance criterion #5 met.
- **Combat freeze interaction:** `tweens.pauseAll()` pauses combat-layer tweens too, and the CombatLayer is not destroyed during a freeze, so resuming returns to the same encounter frame. Spec step 5 ("freeze doesn't break combat surface") is satisfied.

# Review Pass: task-cestus

**Task:** `cestus` — `/quest/:questId` route + Phaser quest mount + HUD overlay
**Branch:** feature/cestus
**Parent:** feature/catapult
**Verdict:** FAIL — 4 bugs filed (2 CRITICAL, 2 HIGH)

## Checks performed

- Read task spec at `metrics/task-cestus-context.md`
- Read full diff (pre-computed by Ralph)
- Read all modified/added source files: `packages/client/src/routes/quest.tsx`, `packages/client/src/features/quest/hud-overlay.tsx`, `packages/client/src/lib/api.ts`, `packages/client/src/app.tsx`, `packages/server/src/routes/quests.ts`, `packages/server/src/__tests__/quests-advance-scene.test.ts`, `packages/client/src/__tests__/quest-route.test.tsx`
- Cross-referenced `packages/client/src/game/phaser-mount.tsx`, `packages/client/src/game/scene-router.ts`, `packages/client/src/routes/town.tsx`, `packages/server/src/routes/adventurers.ts`
- Ran `pnpm --filter @code-quests/client test`, `pnpm --filter @code-quests/server test`, `pnpm --filter @code-quests/client lint`, `pnpm --filter @code-quests/client typecheck`, `pnpm --filter @code-quests/server lint`, `pnpm --filter @code-quests/server typecheck` — all PASS
- Boundary contract validation: `QuestSceneKey` used by the new `POST /quests/:id/advance-scene` body matches the shared schema; the new `AdvanceSceneResponseSchema` matches the server response. SQL `current_scene` column values match the enum.
- Secrets grep: none found in diff
- Phase-capstone coverage: this is NOT the last task of Phase 5 (capstone is `greatsword`), so capstone coverage rule defers to that task. No HIGH filed for unreachable-from-town navigation.

## Findings

### CRITICAL

1. **`review-1.md` — QuestRoute mounts wrong initial scene.** `useRef` for `mountScene` is initialized with `quest?.currentScene ?? 'quest-forest'` BEFORE the TanStack Query resolves. The ref captures the fallback once and never updates, so every quest opens in the forest scene regardless of its persisted `currentScene`. Test fails to catch this because it only ever passes `currentScene: 'quest-forest'`.

2. **`review-2.md` — 404 empty-state unreachable in production.** `fetchJson` in `packages/client/src/lib/api.ts` throws a plain `Error` on non-OK responses, but the QuestRoute's `is404` branch checks `error instanceof ApiError`. Real 404s fall through to the generic "Could not load quest" copy. The unit test passes only because it manually constructs an `ApiError` instead of exercising the real transport.

### HIGH

3. **`review-3.md` — HUD contrast violations on dark backgrounds.** The top banner (`rgba(30,20,10,0.85)`) and combat-log placeholder (`rgba(20,12,5,0.75)`) are near-black, but the text inside uses `text-gray-500/-600/-800`. `text-gray-800` on near-black is effectively invisible. Fails WCAG AA (4.5:1).

4. **`review-4.md` — Missing axe-core test for the new route.** Task spec explicitly requires "axe-core scan on the quest route: zero violations." No such test exists; the new vitest file uses only Testing Library assertions and no axe is wired into an e2e spec for `/quest/:questId`.

## Informational notes (no bug filed)

- **401 status for "no active agent"** is semantically a stretch (a 403 or 409 would fit better), but the task spec explicitly mandates 401, so this matches the spec and is not a bug. Consider revisiting the status code at the API design level in a future task.
- **Navigation into `/quest/:questId` from the Town UI** is not yet wired. This is expected — Phase 5 capstone (`greatsword`) is responsible for end-to-end reachability per the phase plan.
- **`AdventurerName` subcomponent is defined in the same module** as `HUDOverlay`. With more states (selected/loading/missing) it might be cleaner to extract, but currently it's small enough; not a bug.
- **`useEffect` with `return sceneRouter.onSceneAdvance(handler)`** correctly uses the subscribe-returns-unsubscribe pattern and `handleSceneAdvance` is stabilized by `useCallback` with `[advanceMutation.mutate]` (stable per React Query). Looks fine.
- **`postJson` body uses `{ expectedFrom }`** which matches the server's Zod schema (`{ expectedFrom: QuestSceneKey }`). Boundary OK.
- **Server returns `'quest-boss-room'` as a hardcoded string** in the terminal branch (`packages/server/src/routes/quests.ts:595`) — this matches `row.current_scene` for the terminal scene and is fine; the response is also validated client-side via `AdvanceSceneResponseSchema`.

## Verdict

**FAIL** — 4 bugs filed (CRITICAL × 2, HIGH × 2). Fix `review-1.md` and `review-2.md` first; they are user-visible runtime failures.

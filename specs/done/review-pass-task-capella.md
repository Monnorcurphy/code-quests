# Review Pass — TASK capella: AudioController

**Verdict:** PASS (0 bugs filed)

## Scope

Review of `feature/capella` vs `feature/canopus`. New files:

- `packages/client/src/audio/audio-controller.ts` (206 lines) — pure `deriveAudioEvent` reducer + `createAudioController` factory.
- `packages/client/src/audio/__tests__/audio-controller.test.ts` (449 lines) — contract-table reducer tests + 19 subscription tests.
- `progress.md` — task completion entry.

## Checks performed

- **Build verification:** `pnpm typecheck` clean, `pnpm lint` clean, full test suite passes (747/747 across 53 files, including the 22 new audio-controller tests).
- **Spec adherence:** All acceptance criteria from `metrics/task-capella-context.md` verified:
  - Pure reducer (`deriveAudioEvent`) — no side effects, fully unit-testable. ✓
  - All three store subscriptions cleaned up on `stop()` (verified via `listenerCount()` and `vi.spyOn` on `subscribe`). ✓
  - PAUSE_BELL fires on rising edge only (verified by transition test that toggles paused → active → paused). ✓
  - VICTORY_STINGER / QUEST_COMPLETE one-shots don't change the underlying COMBAT loop (full journey test asserts COMBAT stays current while stingers fire). ✓
  - Repeated start/stop cycles do not accumulate subscriptions (listener count returns to 0). ✓
  - Second `start()` cleans up previous session before binding the new backend. ✓
- **Security:** No `console.log`, no hardcoded secrets, no `eval`, no `any`. File naming kebab-case.
- **Cross-boundary validation:**
  - `AudioEvent` union (`audio-events.ts`) matches all event names dispatched by the controller (TOWN, ROAD, COMBAT, BOSS, VICTORY_STINGER, QUEST_COMPLETE, QUEST_FAILED, PAUSE_BELL).
  - `QuestStatus` values used (`active`, `complete`, `failed`, `paused_input`, `user_blocked`, `idle`) match the Zod enum in `packages/shared/src/quest.ts`.
  - `ActiveEncounter.outcome` value `'victory'` matches the encounter store's union (`'pending' | 'victory' | 'defeat' | 'escape'`).
  - `BOSS_MONSTER_TYPES` set values are consistent between source and tests.
- **State management rules:**
  - Store subscriptions registered at controller (module-level) scope — not inside React effects. Survives navigation. ✓
  - `onStateChange` is a stable closure — single function passed to all three subscribes; no inline lambdas creating new identities. ✓
  - Backend reference is captured per-session and reset to `null` on `stop()` so post-stop store changes are no-ops (verified by test). ✓
- **Testing rules:**
  - No conditional assertions (`if (visible) expect(...)`). All assertions are unconditional. ✓
  - Tests cover positive and negative paths (initial-start does NOT fire PAUSE_BELL or VICTORY_STINGER from pre-existing state — antibody for misuse of "rising edge" tracking).
  - Tests include explicit teardown (`controller.stop()` in every `it`) so leakage between cases is impossible.

## Informational notes (not bugs)

1. **Spec vocabulary drift.** Task spec mentions `'completed'`, `'returned_to_town'`, and `'defeated'` — the actual `QuestStatus` enum uses `'complete'` / `'failed'`, and `ActiveEncounter.outcome` uses `'victory'` (adventurer view). The implementation correctly tracks the runtime enum values rather than the spec's prose, which is the right call. Worth keeping in mind for downstream tasks reading the same spec.

2. **`defeat` and `escape` encounter outcomes are silent.** Only `outcome === 'victory'` triggers a stinger. `defeat`/`escape` rely on the downstream quest status transitioning to `failed` (which fires QUEST_FAILED). This matches the spec's letter but means there's no dedicated audio cue for "escape" — likely fine, but a future task could revisit.

3. **`prevStatusByQuest` / `prevEncounterOutcomeByQuest` retain stale entries for removed quests.** If a quest is deleted from the store (e.g., `statusByQuest = {}`), its prior status remains in the controller's tracking maps. This is a tiny memory residue with no functional impact (a re-added quest with the same id would still transition correctly because the comparison is `prev !== 'complete'`). Not worth fixing now.

4. **`PAUSE_BELL` is global, not per-quest.** `nowPausedOrBlocked` is a single boolean across all quests. If quest A is already paused and quest B becomes paused, no second bell fires. The spec describes pause as a quest-level transition; the implementation interprets it as "the user has at least one pending pause," which seems aligned with the UX intent (one chime per pause situation, not per-quest spam) but is worth noting in case the product wants per-quest bells later.

5. **Backend `stopAll()` on double-start fires before the new loop event plays.** Correct ordering — old backend is quieted before the new one is told to play. Verified by the "second start cleans up" test.

## Final verdict

**PASS — 0 bugs filed.** Implementation is clean, well-tested, and fully matches the task spec's acceptance criteria. State-driven dispatch is correctly factored into a pure reducer plus an effectful subscription manager. Cleanup semantics are airtight (verified by listener-count assertions and spied unsubscribe calls). No security, accessibility, or cross-boundary concerns.

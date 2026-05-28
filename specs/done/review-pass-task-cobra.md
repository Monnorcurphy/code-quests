# Review Pass — Task cobra

**Task:** Player avatar + keyboard movement controller
**Branch:** feature/cobra (parent: feature/bobcat)
**Commit reviewed:** 196e4c4

## Checks Performed

- Pre-computed diff read (no `git diff` re-run by reviewer)
- `pnpm test` — all 88 client tests pass (17 player + 13 keyboard-controller new) and 67 server tests pass after a flaky first run (re-ran cleanly)
- `pnpm typecheck` — clean
- `pnpm lint` — clean (no output = no errors)
- `pnpm build` — clean (client + server + shared)
- Secrets grep (`sk-`, `AKIA`, `api_key`, `password=`) — none found in changed files
- `console.*` grep on `packages/client/src/game/**` — none found
- Cross-boundary check — `town-store.facing` union (`'left' | 'right'`) matches `Player.facing` getter return; `playerX: number` matches `Player.getX()`. No DB or backend boundaries cross in this task.
- Accessibility — keyboard-only control surface implemented; cursor/WASD/Enter/Esc/Tab events emitted (Tab integration with scene focus is task-cobra scope per spec, but actual cycling of focus through interactables is not yet wired — see INFO #2 below).
- Conditional-assertion check — all `expect(...)` calls in the new test files are unconditional. No `if (...)` wrappers around assertions.
- Capstone coverage — N/A; cobra is mid-phase, not the Phase 2 capstone.

## Bugs Filed

| # | Severity | Title |
|---|---|---|
| review-1 | HIGH | Missing test for `prefers-reduced-motion` animation behavior |
| review-2 | LOW  | `SceneKey` type cast in test-scene bypasses TypeScript safety |
| review-3 | LOW  | Dead key allocations in `KeyboardController` (unused W / up / down / space / shift) |

## Informational Notes

1. **Player position is store-only.** `test-scene.ts` writes `useTownStore.getState().setPlayerX(...)` every frame, but it does not read the stored `playerX` when constructing the `Player` (it always starts at `PLAYER_START_X = 200`). The spec acceptance criterion #4 says *"Player position survives scene swaps (verified by reading `town-store` after a programmatic `setScene()`)"* — that is technically met because the store value is independent of scene lifetimes, but the deeper behavior (actually restoring the player at their saved x on scene entry) is deferred. When real Town/Quest scenes are wired up in later Phase-2 tasks, those scenes will need to initialize the player at `store.playerX`. Calling out so the next builder sees it.

2. **Tab `next-interactable` cycling not implemented.** Spec acceptance criterion #6 says Tab should navigate inside the canvas to the next interactive (door / Quest Board / banner). The controller correctly emits a `tab-next` event, but no scene currently consumes it to cycle focus among interactables. This is plausibly the right scope split (controller emits, scenes consume), but until a scene wires it up, the acceptance criterion is only half-satisfied.

3. **Anim cache reuse.** Phaser's animation manager is global per game. `_setupAnimations` guards with `scene.anims.exists(...)` so the first `Player` to be constructed "wins" the frame rate decision — a later `Player` with a different `reducedMotion` preference will silently reuse the existing animation. Won't matter while the app only constructs one Player at a time, but worth noting for future scene-swap logic.

4. **Reduced-motion semantics are ambiguous in the spec.** The spec says reduced motion *"shortens animation frames"*; the implementation reduces the playback frame rate (8 → 2). That's a defensible reading. An alternative reading is *fewer frames in the animation cycle*. Either is consistent with "less smoothed motion" — flagging only because reviewers in later tasks may revisit this.

5. **Server test flakiness.** The first run of `pnpm test` failed `POST /epics > rejects missing title with 400` on the server package, but a re-run on the same commit passed cleanly. This isn't a cobra regression (cobra touched no server files), but it's a flake worth filing separately if it recurs.

## Final Verdict

**FAIL** — 3 bug files filed (1 HIGH, 2 LOW). The HIGH (`review-1`) blocks task closure because it represents a missing test for an explicit spec acceptance criterion (reduced-motion frame rate). The LOWs should be addressed in the same fix round.

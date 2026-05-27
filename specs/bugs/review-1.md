# BUG: Missing test for `prefers-reduced-motion` animation behavior

**Severity:** HIGH
**File(s):** packages/client/src/game/entities/__tests__/player.test.ts, packages/client/src/game/entities/player.ts

## Problem

Spec acceptance criterion #5 explicitly requires: *"`prefers-reduced-motion: reduce` shortens animation frames and disables velocity easing"*.

`packages/client/src/game/entities/player.ts` implements this by switching `WALK_FRAME_RATE_NORMAL` (8) to `WALK_FRAME_RATE_REDUCED` (2) when `reducedMotion` is true (see `_setupAnimations`, lines 55–77). However, **no test verifies the frame rate actually differs based on `reducedMotion`**. Every existing test passes `{ reducedMotion: false }` (or doesn't pass `reducedMotion` at all), so the reduced-motion code path is completely uncovered.

Likewise, in `packages/client/src/game/input/keyboard-controller.ts` the `reducedMotion` field is captured as a property but never consumed by any logic. The single test that mentions it (`'reducedMotion reflects the provided option'`) only asserts the prop equals what was passed in — a tautology that does not exercise any behavior change.

The rules file `.claude/rules/testing.md` says: *"Every async function that calls an external service must have a test where the call rejects"*, and the review-contract rules note missing tests as HIGH severity. Acceptance criteria without verifying tests escape review.

## Expected

- A unit test that constructs a `Player` with `{ reducedMotion: true }` and asserts `scene.anims.create` was called with `frameRate: 2` (or equivalent) for the `player-walk` animation.
- A corresponding test for `{ reducedMotion: false }` (or default) asserting `frameRate: 8`.
- If `KeyboardController.reducedMotion` is intended to drive behavior, add the behavior + a behavioral test. If it is forward-declared and currently unused, remove the field and the tautological test until it is wired up (dead code policy in `.claude/rules/code-quality.md`).

## Fix

1. In `packages/client/src/game/entities/__tests__/player.test.ts`, add tests:
   ```ts
   it('uses reduced walk frame rate when reducedMotion is true', () => {
     new Player(scene, 0, 0, BOUNDS, { reducedMotion: true });
     const calls = (scene.anims.create as any).mock.calls;
     const walkCall = calls.find((c: any) => c[0].key === 'player-walk');
     expect(walkCall[0].frameRate).toBe(2);
   });

   it('uses normal walk frame rate when reducedMotion is false', () => {
     new Player(scene, 0, 0, BOUNDS, { reducedMotion: false });
     const calls = (scene.anims.create as any).mock.calls;
     const walkCall = calls.find((c: any) => c[0].key === 'player-walk');
     expect(walkCall[0].frameRate).toBe(8);
   });
   ```
2. Decide whether `KeyboardController.reducedMotion` should drive behavior (then add the behavior + a test that exercises it) or be removed entirely (and remove the tautological test).

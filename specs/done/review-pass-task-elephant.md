# Review Pass — Task elephant

**Branch:** feature/elephant
**Parent:** feature/deer
**Verdict:** FAIL (4 bugs filed: 1 CRITICAL, 1 HIGH, 2 LOW)

## Checks Performed

- Read CLAUDE.md, all active rules, and the task spec (`metrics/task-elephant-context.md`)
- Reviewed pre-computed diff (12 files, +813/-79)
- Read full source of all new/modified files:
  - `packages/client/src/game/scenes/town-square-scene.ts`
  - `packages/client/src/game/scenes/placeholder-scene.ts`
  - `packages/client/src/game/scenes/base-town-scene.ts` (diff)
  - `packages/client/src/game/interactives/quest-board.ts`
  - `packages/client/src/game/interactives/recruit-banner.ts`
  - `packages/client/src/game/game-config.ts`
  - `packages/client/src/features/town-square.tsx`
  - `packages/client/src/routes/town.tsx`
  - `packages/client/src/stores/town-store.ts`
  - `packages/client/src/game/scenes/__tests__/town-square-scene.test.ts`
  - `packages/client/tests/e2e/town-square.spec.ts`
- Cross-referenced supporting code: `player.ts`, `keyboard-controller.ts`, `door.ts`, `scene-router.ts`, `scene-registry.ts`, `recruit-modal.tsx`, `roster.tsx`, `quest-board.tsx`, `use-focus-trap.ts`, `scene-keyboard-nav.tsx`, `boot-scene.ts`
- Ran `pnpm --filter @code-quests/client typecheck` → clean
- Ran `pnpm --filter @code-quests/client lint` → clean
- Ran `pnpm --filter @code-quests/client test` → 137 tests passing
- Ran `npx playwright test town-square` → 10/10 passing
- Ran `npx playwright test phase-1-capstone` → 6 pass, **1 FAIL** (persistence)
- Grepped for secrets (`sk-`, `AKIA`, `api_key`, `password=`) — none found
- Grepped for `console.log` in production code — none found
- Verified Tailwind/CSS contrast classes — no `-100/200/300/400` text on light bg used
- Checked accessibility: `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap, focus return — present

## Bugs Filed

| # | Severity | Title |
|---|----------|-------|
| 1 | CRITICAL | Phase 1 capstone "persistence" test fails — Escape no longer fully closes Town Square modal |
| 2 | HIGH     | Conditional assertion in Town Square empty-state e2e test (.catch swallows assertion error) |
| 3 | LOW      | Dead `controller.on('back')` listener in TownSquareScene |
| 4 | LOW      | "update skips game logic" test asserts on the wrong mock |

## Cross-Boundary Validation

- The `activeModal` enum (`'recruit' | 'draft' | 'quest-board' | null`) is shared between scene activators (`quest-board.ts`, `recruit-banner.ts`) and React consumer (`town-square.tsx`). Both sides use the same string literals; values match.
- `SceneKey` type is consistent across `scene-registry`, `scene-router`, `town-square-scene`, `placeholder-scene`, `town.tsx`. No mismatch.
- `DoorConfig.targetScene` values (`war-room`, `oracle`, ..., `hall-of-returns`) are all registered as placeholder scenes via `placeholder-scene.ts`. No orphan scene references.
- No SQL/DB CHECK constraints touched in this diff — N/A for SQLite cross-boundary.

## Capstone Coverage

This is NOT the last task of the phase (the phase plan still has more tasks per `specs/phase-02/` and the codename sequence). Capstone coverage rule does not apply at this gate. However, the Town Square scene IS the entry-point for the phase's eventual capstone, and reachability from the app entry-point (`/town` HTML mode and `/town/town-square` Phaser mode) is wired up correctly.

## Informational Notes (not filed as bugs)

- **Duplicate interactive code (`quest-board.ts`, `recruit-banner.ts`)** — these two files are ~90% identical. Per `.claude/rules/code-quality.md` "Rule of Three", this is acceptable at the 2nd occurrence. When a 3rd interactive type is added (e.g. NPC, sign), extract a base `InteractiveZone` class.
- **`sceneRouter.setInteractives` is called twice during `TownSquareScene.create()`** — once by `super.create()` with just doors, once by the override with doors + quest-board + recruit-banner. React 18 batches state updates so consumers see one effective render, but the intermediate call is wasted work. Minor.
- **`progress.md` status reads "Done" while previous task entries read "Complete"** — naming inconsistency.
- **`Roster` empty-state copy is "No adventurers yet — recruit your first hero."** — the task spec asked for "No adventurers yet — click the recruit banner." The existing copy was preserved per spec wording ("Empty states preserved"), but if you want to align with the spec's exact phrasing this is the place.
- **Type-only import** — `quest-board.ts` and `recruit-banner.ts` use `import Phaser from 'phaser'` even though only `Phaser.GameObjects.Rectangle` and `Phaser.Scene` types are referenced. `import type Phaser from 'phaser'` would be more accurate but is purely a style nit.

## Verdict

**FAIL** — 4 bug files created in `specs/bugs/`. The CRITICAL Phase 1 capstone regression must be fixed before this task can ship; the HIGH conditional-assertion bug undermines coverage of the empty-state acceptance criterion. The two LOW issues are quick cleanups.

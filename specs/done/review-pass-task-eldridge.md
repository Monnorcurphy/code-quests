# Review Pass — TASK eldridge

**Branch:** `feature/eldridge` (parent `feature/carmania`)
**Scope:** Phaser combat surface — `MonsterSprite`, HP bar, encounter HUD overlay, scene wiring.

## Checks performed

- Read the full pre-computed diff (10 files, ~840 inserted lines).
- Read `monster-sprite.ts`, `base-quest-scene.ts`, `hud-overlay.tsx`, `phaser-mount.tsx`, `game-config.ts`, `routes/quest.tsx`, the two new test files, and the updated `quest-scenes.test.ts`.
- Cross-referenced with the encounter store (`encounter-store.ts`) and the shared `AgentEvent` Zod schema (`packages/shared/src/agent.ts`).
- Ran `pnpm --filter @code-quests/client test` → **493/493 passing**.
- Ran `pnpm --filter @code-quests/client lint` → clean.
- Ran `pnpm --filter @code-quests/client typecheck` → clean.
- Grepped for hardcoded secrets (`sk-`, `AKIA`, `api_key`, `password=`) → none in the new files.
- Cross-boundary validation: `monster_appeared` event schema (`difficulty: int 1..5`) matches `ActiveEncounter['difficulty']` (1|2|3|4|5 union). HUD `'☆'.repeat(5 - difficulty)` is safe given the schema bound.
- Accessibility: encounter region uses `role="region"`, `aria-label`, `aria-live="polite"`; HP bar uses `role="meter"` with valuenow/min/max; sprite `<img>` has `alt={monsterName}`; difficulty stars have descriptive `aria-label`. Color contrast on inline text (`#f5f5f5`, `#f5deb3`, `#aaa` on `rgba(20,10,0,0.88)`) is well above 4.5:1.
- Reduced-motion: `MonsterSprite` correctly gates tween/shake/escape on the `reducedMotion` option; `base-quest-scene.ts` reads `matchMedia('(prefers-reduced-motion: reduce)')` and forwards it. **HTML overlay transitions are NOT gated — see bug review-1.**
- Capstone coverage: eldridge is an interior task of phase 6, not a phase capstone; capstone coverage check does not apply.

## Bugs filed

| File | Severity | Summary |
|---|---|---|
| `specs/bugs/review-1.md` | HIGH | HUD encounter panel uses `transition: 'opacity 0.2s ease'` and `transition: 'width 0.3s ease'` unconditionally; violates `prefers-reduced-motion` rule. The Phaser side is gated correctly but the HTML mirror is not. |
| `specs/bugs/review-2.md` | LOW | `expect(queryByRole(...)).toBeDefined()` in the new HUD test always passes (null is defined). Also collapses a duplicated `import type` line. |

## Informational notes

- The `BaseQuestScene` subscription to `useEncounterStore` does not fire for the current value at mount — only for subsequent changes. In normal play this is fine because scene transitions are blocked while an encounter is active, so an encounter cannot appear without the scene already being subscribed. Worth keeping in mind if future tasks introduce scene swaps during an encounter (e.g., boss-room hand-off).
- `_prevEncounter` is shallow-cloned via `{...encounter}`; safe today because `ActiveEncounter` has no nested objects, but if any nested field is added later the clone strategy will need to be revisited.
- The encounter panel renders the `<region>` wrapper unconditionally (with `opacity: 0` when no encounter). Combined with `aria-live="polite"`, this is the intended pattern so the first encounter announcement does not require the region to mount mid-flight; behavior matches spec.

## Verdict

**FAIL — 2 bugs filed (1 HIGH, 1 LOW).**

The HIGH bug is a real accessibility regression (motion is not gated on the new HTML overlay). The LOW bug is a weak test assertion plus a minor import cleanup. All tests/lint/typecheck pass, but the HIGH must be fixed before merging.

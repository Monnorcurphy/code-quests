# Review Pass — TASK intrepid (Combat surface)

## Branch
`feature/intrepid` (parent `feature/empress-of-ireland`)

## Files reviewed (8)
- `packages/client/src/__tests__/combat-layer.test.ts` (new)
- `packages/client/src/__tests__/combat-log.test.tsx` (new)
- `packages/client/src/features/quest/use-quest-stream.ts` (modified)
- `packages/client/src/game/combat-layer.ts` (new)
- `packages/client/src/game/entities/monster-sprite.ts` (modified)
- `packages/client/src/game/hp-bar.ts` (new)
- `packages/client/src/game/scenes/base-quest-scene.ts` (modified)
- `progress.md` (notes)

Also cross-referenced for context:
- `packages/client/src/stores/encounter-store.ts`
- `packages/client/src/features/quest/combat-log.tsx`
- `packages/client/src/features/quest/hud-overlay.tsx`
- `packages/server/src/db/migrations/001_init.sql`
- `packages/server/src/services/monster-detection.ts`
- `packages/server/src/routes/monsters.ts`
- `packages/shared/src/monster.ts`

## Checks performed
- `pnpm --filter @code-quests/client test` → 546/546 pass
- `pnpm --filter @code-quests/client typecheck` → clean
- `pnpm --filter @code-quests/client lint` → clean
- `./checks/contrast-classes.sh .` → 14 violations (4 are new from this task — see `review-4.md`)
- Secret scan (grep for `sk-`, `AKIA`, `api_key`, `password=`) → no hits in changed files
- Boundary/cross-system validation against server DB schema and API response shape (see `review-2.md`, `review-3.md`)
- Capstone coverage: not the last task of a phase — skipped
- Test quality: no conditional assertions, no commented-out code, no debug prints in changed files

## Bugs filed
- `specs/bugs/review-1.md` — **CRITICAL** — `MonsterSprite.playDefeat` leaks Phaser game objects (sprite, name label, difficulty banner, HP bar) on every defeat outcome; visible ghost monster until scene transition.
- `specs/bugs/review-2.md` — **HIGH** — Reconnect rehydration synthesizes `monster_resolved` with `outcome: 'escape'` for in-flight encounters, because the server stores `outcome = 'escape'` as the DB default before resolution. Cross-boundary bug — UI ends combat prematurely after any WS blip.
- `specs/bugs/review-3.md` — **HIGH** — Reconnect rehydration is gated on the client already holding a `pending` encounter, so it does nothing when the client lost the `monster_appeared` event (page refresh, navigation, tab reopen). UI does not match server reality in those cases.
- `specs/bugs/review-4.md` — **HIGH** — `combat-log.tsx` introduces four banned low-contrast Tailwind classes (`text-gray-100/200/300`). Violates `.claude/rules/accessibility.md`.

## INFORMATIONAL notes (no bug filed)
- **Spec file-path deviations.** The spec lists `packages/client/src/scenes/quest/combat-layer.ts`, `packages/client/src/scenes/quest/hp-bar.ts`, and `packages/client/src/state/combat-store.ts`. The implementation chose `packages/client/src/game/combat-layer.ts`, `packages/client/src/game/hp-bar.ts`, and `packages/client/src/stores/encounter-store.ts` (renamed). These locations are consistent with the existing codebase layout (the rest of the Phaser code lives under `game/`, the rest of the Zustand stores live under `stores/`), so this is a reasonable deviation worth recording but not fixing.
- **Parchment styling.** The spec calls for a "parchment-styled" combat log; the implementation uses a dark wash (`rgba(20, 12, 5, 0.75)`) on `hud-overlay.tsx` for the log container. Visually consistent with the rest of the HUD chrome, but not the parchment treatment the spec hints at.
- **`scripts/verify.sh` contrast-classes path is broken.** The check is invoked as `${SCRIPT_DIR}/../../checks/contrast-classes.sh` which resolves to a path *above* the project root and silently does not exist. Result: the HARD contrast gate effectively no-ops during `verify.sh`. This is factory script territory (Constitution rule 3 — no factory self-modification by build/fixer agents); a human PR should fix the path to `${SCRIPT_DIR}/../checks/contrast-classes.sh`.
- **`HpBar` has no dedicated unit test.** The combat-layer tests mock `MonsterSprite` (which owns the `HpBar`), so the `HpBar` color-threshold logic (`>0.5` green, `>0.25` amber, else red) is unexercised. Class is small (~47 lines) and Phaser-bound; not filed as a bug but worth covering.
- **`base-quest-scene.update` does not freeze player movement during combat.** The encounter blocks scene advancement (`!this._combatLayer?.encounterActive`), but the player can still walk past the monster sprite during a fight. Spec does not require freezing movement, so no bug filed — flagging for the designer to consider.
- **`useEncounterStore.byQuest` keys are never deleted.** `clearQuest` writes `byQuest[questId] = null`. Bounded by total quests per session, but accumulates. Matches the test the implementation wrote (`'stays at steady state for repeated appear/clear cycles'` asserts `keys === questIds.length`), so this is the documented behavior. Worth noting but not a leak in the strict sense.
- **`event.difficulty as ActiveEncounter['difficulty']` is an unchecked cast.** The shared schema types `difficulty` as `z.number().int().min(1).max(5)` so the value is range-validated at the WS boundary, but the cast assumes that without re-checking on this side. Minor.

## Verdict
**FAIL — 4 bugs filed (1 CRITICAL, 3 HIGH).**

The functional happy path works and is well-tested, but the defeat outcome leaks game objects and the reconnect rehydration silently corrupts state due to a cross-boundary mismatch against the server's DB default. Both need fixing before this surface can be relied on in production.

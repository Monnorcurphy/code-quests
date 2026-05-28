# Progress — Phase 6

Previous task progress archived to metrics/progress-before-eldridge.md

## Task eldridge — Phaser combat surface (monster sprite + HP bar + animations)

- Created `packages/client/src/game/entities/monster-sprite.ts` — MonsterSprite wrapper (sprite, name label, difficulty stars, HP bar) with `setHp`, `playVictory`, `playDefeat`, `playEscape`. All animations gated by `prefers-reduced-motion`.
- Created `packages/client/src/game/entities/__tests__/monster-sprite.test.ts` — unit tests covering HP bar scaling at 0/50/100%, reduced-motion code paths (no tweens), and animation callbacks.
- Modified `packages/client/src/game/scenes/base-quest-scene.ts` — subscribes to encounter store in `create()` (using questId from game registry); spawns MonsterSprite on `monster_appeared`, updates HP on `combat`, plays outcome animation on `monster_resolved`, blocks edge-advance during active encounter.
- Modified `packages/client/src/game/game-config.ts` + `phaser-mount.tsx` + `routes/quest.tsx` — threaded questId through game registry so Phaser scenes can subscribe to the correct quest's encounter state.
- Modified `packages/client/src/features/quest/hud-overlay.tsx` — added accessible encounter panel (`role="region"`, `aria-live="polite"`) showing sprite, monster name, difficulty stars, and HP meter for screen-reader users.
- Created `packages/client/src/features/quest/__tests__/hud-overlay-encounter.test.tsx` — 11 tests covering encounter panel appearance, star ratings, HP updates, clearQuest removal, and aria-live attribute.
- All 493 tests pass. TypeScript clean. ESLint clean.

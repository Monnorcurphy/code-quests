# Progress — Phase 6

Previous task progress archived to metrics/progress-before-empress-of-ireland.md

## empress-of-ireland — Bestiary view in the Library

**Status:** Complete

- Created `packages/client/src/features/library/bestiary.tsx` — main bestiary table with TanStack Query, sortable columns, skeleton loading, empty/error states
- Created `packages/client/src/features/library/monster-detail.tsx` — detail panel with encounter history, fetches quest titles per encounter
- Created `packages/client/src/features/library/empty-state.tsx` — empty state with next-step hint
- Created `packages/client/src/features/library/difficulty-stars.tsx` — shared `DifficultyStars` component with `aria-label="N of 5 stars"`
- Created `packages/client/src/features/library/__tests__/bestiary.test.tsx` — 16 tests including axe-core accessibility checks; all pass
- Modified `packages/client/src/features/library.tsx` — replaced quest context editor with Bestiary + Skills tab placeholder
- Modified `packages/client/src/features/quest/use-quest-stream.ts` — invalidates `['monsters']` cache on `monster_appeared` event
- Modified `packages/client/src/game/scenes/library-scene.ts` — added Ancient Tome interactive for keyboard navigation
- Added CSS for library tabs, bestiary table, skeleton loading, outcome badges, monster detail panel
- Added `jest-axe` + `@types/jest-axe` dev dependencies; configured in test-setup.ts
- Updated `packages/client/src/__tests__/library.test.tsx` — replaced old context-editor tests with new tab/bestiary tests
- All 508 client tests pass; typecheck and lint clean

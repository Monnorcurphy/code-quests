# Progress — Phase 10

Previous task progress archived to metrics/progress-before-ganges.md

## Task ganges — Custom monster type forge UI

- Created `packages/client/src/assets/monster-sprites-manifest.ts` — static manifest of 10 CC0 monster sprites
- Created `packages/client/src/features/library/coin-monster-type-modal.tsx` — full modal with name (1–60 chars), sprite picker (keyboard nav via roving tabindex + arrow keys), difficulty select (1★–5★), regex signature field with inline validation, 409/field-error handling, success toast with type id
- Updated `packages/client/src/features/library/bestiary.tsx` — added `bestiary-header` wrapper + "+ Coin New Type" button above scope tabs; renders `CoinMonsterTypeModal` and invalidates queries on success
- Added CSS in `features.css` — `.bestiary-header`, `.bestiary-coin-btn`, `.coin-type-modal`, `.sprite-picker-grid`, `.sprite-option`, `.sprite-option--selected`, `.sprite-option-img` with `prefers-reduced-motion` support
- Created `packages/client/src/features/library/__tests__/coin-monster-type-modal.test.tsx` — 20 tests covering submit disabled state, invalid regex inline error, arrow-key + Enter keyboard nav, 409 duplicate name, happy path, dismiss
- All 973 client tests + 515 server tests pass; typecheck + lint clean

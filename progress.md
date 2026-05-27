# Progress — Phase 5

Previous task progress archived to metrics/progress-before-arbalest.md

## arbalest — Quest scene art assets + asset-loader keys

**Status:** DONE

**What was done:**
- Added 14 PNG stub assets in `assets/quest/` (all ≥ 1 KB, ≤ 500 KB): 4 backgrounds, 4 props, 4 ground tiles, 2 RGBA monster silhouettes with real transparency (color type 6).
- Extended `scripts/gen-asset-stubs.mjs` with RGBA support (`makePNGRGBA`), 5 new biome palettes, and humanoid silhouette shape functions.
- Added `QUEST_ASSET_KEYS` const and `preloadQuestAssets(scene)` export to `asset-loader.ts`. `preloadCommonAssets` unchanged; quest scenes call `preloadQuestAssets` separately.
- `AssetKey` type now covers both `ASSET_KEYS` and `QUEST_ASSET_KEYS` values so `assetPath()` works for all keys.
- Updated `assets/CREDITS.md` with a `## Phase 5 — Quest scenes` section listing all 14 files with source, author, license, and required attribution text.
- Added 7 new tests covering: file existence, 1 KB minimum, 500 KB maximum, `assetPath()` for quest keys, `preloadQuestAssets` registration completeness, non-pollution of town/dungeon keys, and RGBA color type verification for silhouettes.
- All 331 tests pass; typecheck and lint clean.

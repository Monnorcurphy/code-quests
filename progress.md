# Progress — Phase 2

Previous task progress archived to metrics/progress-before-bobcat.md

## bobcat — Pixel art asset pipeline + CREDITS.md

**Status:** Done

**What was built:**
- `assets/town/` — 11 PNG files (ground, buildings, trees, fence, path) via synthetic stub generator
- `assets/dungeon/tileset.png` — 256×256 dungeon tileset PNG
- `assets/character/` — 4 PNG files (adventurer idle/walk/attack, villager)
- `assets/CREDITS.md` — structured credits for all three packs (Kenney Tiny Town CC0, Kenney 1-Bit Pack CC0, 0x72 Dungeon Tileset II CC-BY)
- `assets/manifest.json` — machine-readable catalog (16 entries, each with license/source/pack)
- `packages/client/public/assets` — symlink to root `assets/` so Vite dev-serves and build-copies all assets
- `packages/client/src/game/asset-loader.ts` — typed `ASSET_KEYS` const, `assetPath()` helper, `preloadCommonAssets(scene)` callable from any Phaser scene
- `packages/client/src/game/__tests__/asset-loader.test.ts` — verifies every key maps to an existing file ≥ 1KB
- `scripts/gen-asset-stubs.mjs` — deterministic PNG generator (replace outputs with real Kenney downloads for release)
- `scripts/check-asset-licenses.sh` + `scripts/check-asset-licenses.mjs` — CI check: fails if any PNG is unlisted or has no license
- `package.json` — added `"check:assets"` script

**Verify results:** 58 unit tests pass, lint clean, typecheck clean, `pnpm check:assets` exits 0, `pnpm build` copies all 16 assets to `dist/assets/`.

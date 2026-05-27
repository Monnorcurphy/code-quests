# BUG: Missing Kenney "Tiny Dungeon" pack

**Severity:** HIGH
**File(s):** assets/CREDITS.md, assets/manifest.json, assets/dungeon/ (and possibly other locations)

## Problem

The task spec (metrics/task-bobcat-context.md, line 8) requires **at minimum** four asset packs for Phase 2:

1. Kenney "Tiny Town" (CC0)
2. Kenney **"Tiny Dungeon"** (CC0)
3. Kenney "1-Bit Pack" (CC0)
4. 0x72 Dungeon Tileset II (CC-BY)

The implementation includes packs 1, 3, and 4, but **Kenney "Tiny Dungeon" is entirely missing** — there is no entry in `CREDITS.md`, no entry in `manifest.json`, and no PNG files attributed to it. The `assets/dungeon/` directory contains only the 0x72 tileset.

This is an explicit miss against the spec's "at minimum" list. Phase 5 (which the dungeon directory was supposed to validate the pipeline for) will be missing one of two intended dungeon packs.

## Expected

Per the spec line 8 ("At minimum for Phase 2: Kenney 'Tiny Town' (CC0), Kenney 'Tiny Dungeon' (CC0), Kenney '1-Bit Pack' (CC0), 0x72 Dungeon Tileset II"), all four packs must be installed, credited, and listed in the manifest.

## Fix

1. Add Kenney "Tiny Dungeon" pack assets (at least a few representative tiles — wall, floor, door, prop) under `assets/dungeon/`. Source: https://kenney.nl/assets/tiny-dungeon (CC0).
2. Add a "Kenney Tiny Dungeon" section to `assets/CREDITS.md` mirroring the format of the existing "Kenney Tiny Town" entry (CC0 1.0 Universal, no attribution required, files list).
3. Add corresponding manifest entries in `assets/manifest.json` with `pack: "Kenney Tiny Dungeon"`, `license: "CC0"`, `source: "https://kenney.nl/assets/tiny-dungeon"`.
4. If using the synthetic stub generator (`scripts/gen-asset-stubs.mjs`), add Tiny Dungeon entries there too so `pnpm check:assets` keeps passing.
5. Add corresponding `ASSET_KEYS.DUNGEON_*` entries to `packages/client/src/game/asset-loader.ts` for each new file.

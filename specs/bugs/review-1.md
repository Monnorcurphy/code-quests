# BUG: New quest PNGs are missing from assets/manifest.json — `pnpm check:assets` fails
**Severity:** CRITICAL
**File(s):** assets/manifest.json, scripts/check-asset-licenses.mjs (consumer)

## Problem
The 14 new PNGs added under `assets/quest/` (4 backgrounds, 4 ground tiles, 4 props, 2 silhouettes) were **not** added to `assets/manifest.json`. The repo's CI script `pnpm check:assets` (`scripts/check-asset-licenses.mjs`) walks every PNG in `assets/` and demands a matching manifest entry with a non-empty `license` field. Running it now produces 14 `MISSING FROM MANIFEST` violations and exits with code 1:

```
MISSING FROM MANIFEST: quest/bg-boss-room.png
MISSING FROM MANIFEST: quest/bg-cave.png
… (12 more) …
Asset license check FAILED (14 violations).
```

CREDITS.md itself explicitly documents this contract: "`assets/manifest.json` is the machine-readable equivalent used by CI checks." Builder updated the human-readable CREDITS.md but not the machine-readable manifest.

## Expected
- `assets/manifest.json` MUST list every PNG under `assets/` (orphan and missing-from-manifest are both fail states for the CI check).
- Each new entry needs `file`, `pack`, `license`, `source`, `packVersion`, and `attribution` fields matching the same shape used for the existing Tiny Town / Tiny Dungeon / 0x72 entries.
- `node scripts/check-asset-licenses.mjs` MUST exit 0.

## Fix
Append the following 14 entries to the `assets[]` array in `assets/manifest.json`, mirroring the source/license recorded in `assets/CREDITS.md` for each:

- `quest/bg-forest.png`, `quest/ground-forest.png`, `quest/prop-forest-tree.png` — pack `Kenney Nature Platformer`, license `CC0`, source `https://kenney.nl/assets/nature-platformer`, attribution `null`
- `quest/bg-cave.png`, `quest/bg-dungeon.png`, `quest/ground-cave.png`, `quest/ground-dungeon.png`, `quest/prop-cave-rock.png`, `quest/prop-dungeon-pillar.png` — pack `Kenney Tiny Dungeon`, license `CC0`, source `https://kenney.nl/assets/tiny-dungeon`, attribution `null`
- `quest/bg-boss-room.png`, `quest/ground-boss.png`, `quest/prop-boss-throne.png` — pack `Dungeon Tileset II`, license `CC-BY-4.0`, source `https://0x72.itch.io/dungeontileset-ii`, packVersion `1.6.4`, attribution `"Dungeon Tileset II" by 0x72`
- `quest/silhouette-monster-small.png`, `quest/silhouette-monster-large.png` — pack `Kenney 1-Bit Pack`, license `CC0`, source `https://kenney.nl/assets/1-bit-pack`, attribution `null`

After editing, run `node scripts/check-asset-licenses.mjs` and confirm it prints `Asset license check PASSED — 35 assets verified.` (or whatever new total).

# Progress — Phase 8

Previous task progress archived to metrics/progress-before-acrux.md

## Task acrux — Audio asset bundling + CREDITS.md

- Generated 8 placeholder WAV audio stubs via `scripts/gen-audio-stubs.mjs` (CC0, self-generated)
- Files placed in `packages/client/public/audio/` (600 KB total, ≤ 6 MB budget met)
- Created `packages/client/src/audio/asset-manifest.ts` — maps every AudioEvent to its `/audio/*.wav` path
- Created `packages/client/src/audio/__tests__/asset-manifest.test.ts` — 4 tests verifying manifest completeness
- Updated `assets/CREDITS.md` with `## Phase 8 — Audio` section (8 rows + swap suggestions)
- All 51 test files pass; typecheck clean; lint clean

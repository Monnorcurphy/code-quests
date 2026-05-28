# Progress — Phase 8

Previous task progress archived to metrics/progress-before-gacrux.md

## gacrux — Audio capstone (2026-05-28)

**Status:** Done

**What was built:**
- `packages/client/src/audio/audio-controller-mount.tsx` — React component that wires `createAudioController` to the active `AudioBackend` from context. Includes a `makeSceneBridge` adapter that detects `/quest/` routes and synthesizes a quest scene key for the audio controller's scene store, enabling ROAD audio on quest routes.
- `packages/client/src/audio/credits-data.ts` — Hand-mirrored audio credits constants (mirrors `assets/CREDITS.md` Phase 8 section).
- `packages/client/src/features/credits.tsx` — Credits screen component with a table of all 8 audio files (file, author, license). Reachable from Settings → Credits button.
- `packages/client/src/app.tsx` — Updated to mount `<AudioControllerMount />` so the controller runs for all routes.
- `packages/client/src/components/settings-button.tsx` — Added Credits button and sub-panel to the settings modal.
- `packages/client/src/audio/audio-cue-bus.ts` — Added `window.__audioLog__` test hook (appends dispatched events for E2E inspection).
- `packages/client/tests/e2e/phase-8-audio-capstone.spec.ts` — Playwright E2E: boot, mood indicator, quest route audio transition, settings controls, credits screen, a11y on all surfaces.
- `README.md` — Added Phase 8 Audio section with controls reference, troubleshooting, and updated phase roadmap.
- `specs/done/phase-8-walkthrough.md` — Human walkthrough (8 sections from boot to credits).

**Verification:** `pnpm typecheck` ✓ | `pnpm lint` ✓ | `pnpm test` 820/820 ✓ | `pnpm build` ✓

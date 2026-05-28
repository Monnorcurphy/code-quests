# Review Pass — Task gacrux (Phase 8 Audio Capstone)

**Branch:** `feature/gacrux`
**Parent:** `feature/elnath`
**Reviewer model:** Claude Opus 4.7

## Checks performed

- Read task spec `metrics/task-gacrux-context.md` and confirmed scope.
- Read full pre-computed diff (10 files, +572/-47).
- Read each new/modified source file and traced the production audio chain:
  `main.tsx` → `AudioProvider` → `AudioControllerMount` → `createAudioController` → `WebAudioBackend`.
- Read every supporting file referenced by the diff (`audio-controller.ts`,
  `audio-provider.tsx`, `web-audio-backend.ts`, `silent-backend.ts`,
  `audio-events.ts`, `asset-manifest.ts`, `audio-settings.tsx`,
  `app-shell.tsx`, all three visual-cue components, `assets/CREDITS.md`).
- Verified the 8 placeholder audio files exist under `packages/client/public/audio/`
  (all between 35 KB and 89 KB — non-empty, decodable .wav).
- Verified `AudioEvent` enum keys match `AUDIO_MANIFEST` keys 1:1 (no
  cross-boundary mismatch).
- Verified `AUDIO_CREDITS` enumerates all 8 files referenced by `AUDIO_MANIFEST`.
- Ran `pnpm typecheck` — clean.
- Ran `pnpm lint` — clean (no warnings, no errors).
- Ran `pnpm test` — 820 tests pass across 55 files.
- Ran `pnpm build` — production bundle builds clean.
- Verified visual-cue components (`SceneMoodIndicator`, `PauseBellFlash`,
  `StingerToast`, `AriaAnnouncer`) are mounted in the persistent shell so
  they survive route changes.
- Verified the focus-trap is preserved in the settings panel.
- Grepped the codebase for `.preload(` to verify the WebAudioBackend
  preload pipeline is wired up — it is not (see CRITICAL bug below).
- Computed contrast for the Credits inline body color `#5c4a2a` against the
  parchment background `#f5f0e8` — ratio ≈ 7.3:1, passes WCAG AA.
- Confirmed no hardcoded secrets in source (no `sk-`, `AKIA`, `api_key`,
  `password=` patterns).

## Capstone-coverage verification

Per `.claude/rules/review-contract.md`, every Phase 8 feature must be
reachable from the app entry point:

| Feature | Reachable via |
|---|---|
| Town / Road / Combat / Boss themes | Auto-triggered by route + store state via `AudioControllerMount` |
| Scene Mood Indicator | Mounted in `AppShell` — visible on every route once a cue fires |
| Pause Bell flash | Mounted in `AppShell` — fires on PAUSED_INPUT |
| Stinger toasts | Mounted in `AppShell` — fires on VICTORY/COMPLETE/FAILED |
| ARIA announcer | Mounted in `AppShell` (sr-only) |
| Mute / Silent Mode / Master Volume | Settings (⚙) → AudioSettings |
| Credits screen | Settings (⚙) → "Credits" button |
| Audio CREDITS.md | Phase 8 section added |

All UI surfaces have a navigable path. No dead-end screens identified.

## Cross-boundary validation

- `AudioEvent` union (`audio-events.ts`) ↔ `AUDIO_MANIFEST` keys
  (`asset-manifest.ts`): exact match for all 8 events.
- `AUDIO_MANIFEST` paths ↔ files in `public/audio/`: every file present.
- `AUDIO_CREDITS` filenames ↔ `AUDIO_MANIFEST` basenames: exact match.

No mismatches detected.

## Verdict

**FAIL — 4 bugs filed.**

| # | Severity | Summary |
|---|---|---|
| 1 | CRITICAL | `WebAudioBackend.preload()` is never called in production — no audio actually plays despite all the wiring. |
| 2 | HIGH | Dialog `aria-labelledby="settings-title"` references a removed element while Credits is open; focus is also lost across the view switch. |
| 3 | HIGH | Capstone E2E missing the spec-required assertions for Silent Mode (no `backend.play`) and Mute (`backend.setMuted(true)`). |
| 4 | LOW | `window.__audioLog__` test hook shipped unconditionally in `audio-cue-bus.ts` — should be gated by `import.meta.env.DEV` or replaced with a real subscriber. |

## Informational notes

- The capstone E2E test file uses `await page.waitForTimeout(500)` as a fixed
  delay (lines 43, 213). This is a flaky-test anti-pattern. Prefer
  `expect(...).toBeVisible({ timeout: ... })` or polling. Not filed as a
  bug because the timeouts are conservative enough that the tests should
  not flake in practice, but worth replacing in a follow-up.
- `phase-8-audio-capstone.spec.ts` line 6 uses
  `Parameters<typeof test.fn>[0]['page']` to get the `Page` type. Prefer
  `import { Page } from '@playwright/test'` directly. Style nit.
- `Credits` uses inline `style={{ ... }}` props throughout instead of a
  CSS class file. Inconsistent with the rest of the client (which uses
  `features.css`). Worth refactoring into `.credits-*` classes in a
  follow-up so reduced-motion / theme overrides can apply.
- The mood indicator hardcodes the scene to `'quest-forest'` for any
  `/quest/*` route in `audio-controller-mount.tsx`. This is fine for the
  ROAD/BOSS audio derivation (which only depends on `isQuestSceneKey`), but
  it means the audio system has no awareness of forest→cave→dungeon→boss
  scene transitions — something to revisit if per-scene ambience is added
  in a future phase.
- `pnpm test` only runs vitest. The new Playwright suite
  (`phase-8-audio-capstone.spec.ts`) is invoked separately via
  `pnpm test:e2e`. CI should verify both — calling out so the gate is
  obvious to the fixer agent.

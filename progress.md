# Progress — Phase 11

Previous task progress archived to metrics/progress-before-capricorn.md

## capricorn — Pre-capstone UX polish (complete)

- **Contrast violations fixed**: replaced banned `text-gray-{100,200,300}` Tailwind classes in `hud-overlay.tsx` and `return-to-town-button.tsx` with inline style color values; `checks/contrast-classes.sh` exits 0
- **Bell flash for reduced-motion users**: added `flashKey` state to `BellCue` — renders `.pause-bell-flash--static` overlay (no animation, static for 800ms) when `prefers-reduced-motion` is active; animated version auto-fades in 400ms for motion users. Uses pre-existing CSS classes from `features.css`
- **Pause all app animations on modal open**: `PausedInputModal` now sets `data-quest-paused="true"` on `document.body` when visible; added CSS rule in `features.css` that sets `animation-play-state: paused !important` on all child elements (excluding the modal itself and the flash overlay)
- **Accessibility sweep E2E test**: created `packages/client/tests/e2e/accessibility-sweep.spec.ts` covering Town Square, War Room, Guild Hall, Oracle, Library, Armory, Tavern, Hall of Returns, Quest scene, PAUSED_INPUT modal, reduced-motion bell-flash, and body pause attribute
- **Contrast audit**: created `packages/client/src/styles/contrast-audit.md` recording all tailwind class swaps
- All 995 unit tests pass, typecheck clean, lint clean

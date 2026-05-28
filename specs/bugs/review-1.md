# BUG: HUD encounter panel transitions ignore prefers-reduced-motion
**Severity:** HIGH
**File(s):** `packages/client/src/features/quest/hud-overlay.tsx`

## Problem
The new encounter overlay introduces two inline CSS transitions that animate unconditionally:

- The wrapper region (line 169): `transition: 'opacity 0.2s ease'`
- The HP-bar fill (line 235): `transition: 'width 0.3s ease'`

Neither transition is gated by `prefers-reduced-motion`. A user with reduced-motion enabled will still see the overlay fade in/out and the HP bar slide. This is the textual/SR-accessible mirror of the Phaser-canvas encounter, so it must observe the same motion rules as `MonsterSprite` (which is gated correctly via the `reducedMotion` option in `base-quest-scene.ts:163`).

This is also inconsistent with the project pattern: every other animation in the client (`global.css`, `features.css`, `base-quest-scene.ts`, `scene-router.ts`, `player.ts`) reads `prefers-reduced-motion` and skips motion when reduce is set.

## Expected
Per `rules/accessibility.md` (#9 "Respect `prefers-reduced-motion`. Gate animations and transitions behind media queries.") and `rules/ux-feedback.md` ("Respect `prefers-reduced-motion`: skip animations, use instant show/hide instead"), animated transitions on UI surfaces must be skipped when the user has set reduce.

The eldridge task spec also explicitly calls this out: "All animations are gated by `prefers-reduced-motion` per `rules/accessibility.md` — reduced motion = instant transitions, no shake/flash." The Phaser side honors this; the HTML overlay must too.

## Fix
Read `prefers-reduced-motion` once in `HUDOverlay` and conditionally apply the transitions, e.g.:

```tsx
const reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

// wrapper
transition: reducedMotion ? 'none' : 'opacity 0.2s ease',

// hp bar fill
transition: reducedMotion ? 'none' : 'width 0.3s ease',
```

Alternatively, move the encounter panel styles to `features.css` and wrap the `transition` declarations in a `@media (prefers-reduced-motion: reduce) { ... transition: none; }` block, matching the existing pattern used elsewhere in the project.

Add a unit test that mounts the HUD with `matchMedia` mocked to return `matches: true` and asserts the rendered `transition` style is `none` (or that the relevant style is absent).

# BUG: combat-log.tsx uses banned low-contrast Tailwind classes (WCAG 4.5:1)
**Severity:** HIGH
**File(s):** packages/client/src/features/quest/combat-log.tsx

## Problem
The new `CombatLog` component introduces four uses of Tailwind classes that the project's accessibility rules explicitly ban as failing WCAG AA 4.5:1:

- `combat-log.tsx:76` — `className="text-gray-200"` on the empty-state paragraph.
- `combat-log.tsx:92` — `className="text-gray-300"` on the timestamp `<span>`.
- `combat-log.tsx:96` — `className="text-gray-100"` on the type-badge `<span>`.
- `combat-log.tsx:108` — `className="text-gray-100"` on the message `<span>`.

Per `.claude/rules/accessibility.md` and `.claude/rules/common-findings.md`:
> `text-{gray,neutral,slate,zinc}-{100,200,300,400}` — all fail contrast
> USE INSTEAD: `text-gray-600`+ for body, `text-gray-500` minimum for secondary

`checks/contrast-classes.sh` flags every one of these. (The project's `verify.sh` references the check at the wrong path so it currently does not gate the build — see review-pass file for an INFORMATIONAL note — but the rule still applies.)

## Expected
Every text class in newly added UI uses `text-gray-500` or darker (`text-gray-600`+ for body text). The combat log container sits on `rgba(20, 12, 5, 0.75)` (a dark wash) inside `hud-overlay.tsx`, so even though the visual contrast may look acceptable, the project's accessibility safelist forbids `-100/200/300/400` regardless.

## Fix
Replace the banned classes in `packages/client/src/features/quest/combat-log.tsx`:
- Line 76 (empty-state): switch `text-gray-200` to a custom color via `style={{ color: '#e0d6c2' }}` (matches the parchment palette) or use an inline color — do not use any banned Tailwind class.
- Lines 92, 96, 108: switch `text-gray-100` / `text-gray-300` to either custom inline colors that read well on the dark `rgba(20, 12, 5, 0.75)` background (e.g., `#f5f5f5` / `#d0c8b8`) or to Tailwind classes that are allowed on the contrast safelist (none of the `gray-100..400` family qualify).

After the change, `./checks/contrast-classes.sh .` should not report any new violations from `combat-log.tsx`.

Note: pre-existing violations in `hud-overlay.tsx` and `return-to-town-button.tsx` are out of scope for this bug (and out of scope for this task's diff). They should be tracked separately.

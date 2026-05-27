# Accessibility Rules

WCAG-oriented constraints — apply to all UI-producing stacks.

1. **Keyboard accessible**: Every interactive element must be operable via keyboard (Tab, Enter, Escape). No mouse-only interactions.

2. **Focus visible**: All focusable elements must have a visible focus indicator. Never use `outline: none` without providing an alternative.

3. **Color is not the only indicator**: Never convey information through color alone. Use text, icons, or patterns as secondary indicators.

4. **Contrast ratio**: Minimum 4.5:1 for normal text, 3:1 for large text (WCAG AA).
   - Tailwind contrast safelist — NEVER use these (they fail 4.5:1 on white/dark backgrounds):
     - `text-{gray,neutral,slate,zinc}-{100,200,300,400}` — all fail contrast
     - `border-gray-{100,200,300}` — invisible on most backgrounds
     - `placeholder-gray-{100,200,300,400}` — unreadable placeholder text
     - USE INSTEAD: `text-gray-600`+ for body, `text-gray-500` minimum for secondary, `border-gray-500`+ for interactive
     - Enforced via `checks/contrast-classes.sh` (HARD gate — build fails)

5. **Alt text**: Every meaningful image has descriptive alt text. Decorative images use `alt=""`.

6. **Semantic HTML**: Use `<main>`, `<nav>`, `<button>`, `<fieldset>`, `<legend>`. Don't use divs for everything. Proper heading hierarchy.

7. **Form labels**: Every input has a visible `<label>` — no placeholder-only labels.

8. **ARIA attributes**: Use where semantic HTML isn't enough: `aria-label`, `aria-current`, `aria-live`. ARIA supplements, not replaces, semantic HTML.

9. **Motion**: Respect `prefers-reduced-motion`. Gate animations and transitions behind media queries.

10. **Screen reader**: All content must be navigable and understandable with screen readers.

11. **Zero violations**: Run accessibility checks (axe-core or equivalent) in E2E tests — zero violations policy.

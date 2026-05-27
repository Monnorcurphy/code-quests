# BUG: Victory/Defeat badge hidden from screen readers; card label omits outcome

**Severity:** LOW
**File(s):** `packages/client/src/features/hall-of-returns.tsx`

## Problem

In `QuestCard`:

```tsx
<button
  className={`return-card return-card--${isComplete ? 'complete' : 'failed'}`}
  aria-label={`View details for ${quest.title}`}
>
  …
  <span className="quest-badge quest-badge--…" aria-hidden="true">
    {isComplete ? 'Victory' : 'Defeat'}
  </span>
  …
</button>
```

- The badge's only visible text ("Victory" / "Defeat") is `aria-hidden`, so it never reaches the accessibility tree.
- The button's `aria-label` is `View details for {title}` — no outcome included.
- The CSS class differs by status (`return-card--complete` vs `--failed`) but the only sensory-accessible cue at the card level is the border/background color.

A screen-reader user navigating the card list hears "View details for Slay the Dragon" with no indication of whether the quest succeeded or failed. They can infer it from the surrounding column heading ("Victorious" vs "Returned in Defeat") only if they read the headings first — but a user jumping straight to a card via arrow keys or landmarks gets no outcome information.

## Expected

Per `.claude/rules/accessibility.md` rule 3: "Color is not the only indicator. Never convey information through color alone. Use text, icons, or patterns as secondary indicators."

Per the task spec acceptance criteria: "Each card shows adventurer name + class + outcome with both text and color cues."

The outcome must be in the accessibility tree, not only in the column heading.

## Fix

Either:
- Remove `aria-hidden="true"` from the badge so the text "Victory" / "Defeat" is announced; **and/or**
- Include the outcome in the button `aria-label`, e.g.: `aria-label={isComplete ? \`View details for victorious quest ${quest.title}\` : \`View details for failed quest ${quest.title}\`}`.

Add a unit test that asserts the card's accessible name includes the outcome.

# BUG: duplicate horizontal-rule separator in CREDITS.md
**Severity:** LOW
**File(s):** assets/CREDITS.md

## Problem
The Phase 6 addition introduces two consecutive `---` separators (existing line 165 plus a new one at line 167) with only a blank line between them, before the `## Phase 6 — Monster Sprites` heading. Rendered, this produces a doubled horizontal rule that does not appear anywhere else in the document.

```
---           <- end of previous Kenney 1-Bit Pack section
              <- blank line (added)
---           <- duplicate, added by this task
              <- blank line (added)
## Phase 6 — Monster Sprites
```

## Expected
A single `---` separator between sections, consistent with the pattern used elsewhere in CREDITS.md (e.g. lines 149, 165, 194 each stand alone).

## Fix
Delete the redundant `---` block added on or around line 167 of `assets/CREDITS.md` so only the pre-existing separator on line 165 remains between the previous section and `## Phase 6 — Monster Sprites`.

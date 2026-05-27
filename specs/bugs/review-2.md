# BUG: Duplicate `---` separator at the top of the Phase 5 CREDITS section
**Severity:** LOW
**File(s):** assets/CREDITS.md

## Problem
The Phase 5 section in `assets/CREDITS.md` starts with two consecutive `---` separators (lines 89–91), producing a redundant double horizontal rule when rendered:

```
> Dungeon Tileset II by 0x72 — https://0x72.itch.io/dungeontileset-ii — CC-BY 4.0

---

---

## Phase 5 — Quest scenes
```

The first `---` ends the previous (Phase 1) section; the second is the duplicate that the new diff appended.

## Expected
A single `---` between sections, matching the formatting style used everywhere else in the file.

## Fix
Delete the redundant `---` (and its surrounding blank lines) so the structure reads:

```
> Dungeon Tileset II by 0x72 — https://0x72.itch.io/dungeontileset-ii — CC-BY 4.0

---

## Phase 5 — Quest scenes
```

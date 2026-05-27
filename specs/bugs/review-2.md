# BUG: Heading hierarchy skips a level (h2 → h4) in War Room active-quest view

**Severity:** LOW
**File(s):** `packages/client/src/features/war-room.tsx`, `packages/client/src/features/quests/active-quest-panel.tsx`

## Problem

`WarRoom`'s modal title is `<h2 id="war-room-title">War Room</h2>`. When the selected quest is active, `WarRoom` renders `<ActiveQuestPanel>`, whose top heading is `<h4 className="active-quest-title">{quest.title}</h4>` (active-quest-panel.tsx:82). There is no intervening `h3`, so the page jumps from `h2` directly to `h4`.

For non-active terminal states, WarRoom already renders an `<h3 className="war-room-quest-title">` before showing details — so the active-state branch is the only one missing the `h3`.

## Expected

Per `rules/domain/frontend/accessibility.md` rule 6 ("Semantic HTML ... Proper heading hierarchy"), heading levels must not skip. The hierarchy should be `h2 → h3 → h4` (or omit `h4` entirely).

## Fix

Either:
- Promote the active-quest title in `active-quest-panel.tsx` from `h4` to `h3`, and demote any later headings in the panel accordingly, or
- In `war-room.tsx` line 77, wrap `<ActiveQuestPanel>` with an `<h3 className="war-room-quest-title">{quest.title}</h3>` and remove the duplicate `h4` inside the panel (or keep the panel's heading as `h4` if the wrapper supplies the `h3`).

Preferred: promote the panel's own title to `h3` since the panel is reused without an outer wrapper in some contexts.

# BUG: Repost/split linkage doesn't actually link to the new quest

**Severity:** HIGH
**File(s):** `packages/client/src/features/hall-of-returns/actions/action-bar.tsx`

## Problem

The spec requires: "on success closes dialog, shows toast … and **links to the new quest in the Quest Board**". The current implementation renders:

```tsx
<a href="/town/war-room" className="action-bar-link">
  {repostResult.newTitle}
</a>
```

and the same for every split-child title. Two failures:

1. **The link does not identify the new quest.** Every repost link points to `/town/war-room` regardless of `repostResult.newQuestId`. Same for split. A user clicking "New Dragon Quest" lands on the generic War Room with no indication of which quest they just created. The War Room reads `selectedQuestId` from the town store (see `war-room.tsx:163`) to focus a particular quest — that wiring is bypassed entirely.
2. **Full-page reload via `<a href>`.** This is a React-Router app; using a raw anchor causes a hard navigation that throws away in-memory state (toast, tanstack-query cache, focus, audio context). The rest of the app uses `<Link>` / `useNavigate()`.

Result: the post-mortem panel claims a useful linkage but it's effectively a placeholder.

## Expected

Per the spec acceptance criterion ("post-mortem panel updates to show the linkage … links to the new quest in the Quest Board") and the UX-design rule "Speak human … never leave the user without visual feedback for operations":

- Clicking the linked title takes the user to the War Room with the **new** quest selected (highlighted/focused), not the same default page for everyone.
- Navigation stays client-side (no page reload).

## Fix

1. Replace the `<a href="/town/war-room">` anchors with `react-router-dom`'s `Link` (or `useNavigate`) and set the selected-quest state before navigating, e.g.:

```tsx
import { Link } from 'react-router-dom';
import { useTownStore } from '../../../stores/town-store';

const setSelectedQuestId = useTownStore((s) => s.setSelectedQuestId);

<Link
  to="/town/war-room"
  className="action-bar-link"
  onClick={() => setSelectedQuestId(repostResult.newQuestId)}
>
  {repostResult.newTitle}
</Link>
```

Apply the same for the split-child links (use each child's `questIds[i]`).

2. Add a test that asserts clicking the linkage updates `selectedQuestId` (or the analogous navigation target), so this regression can't recur silently.

Note: this fix depends on (or composes with) the schema fix in `review-1.md`, since `newQuestId` and `questIds` are not actually delivered to the client today.

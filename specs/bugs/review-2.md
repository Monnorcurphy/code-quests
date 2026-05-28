# BUG: Empty-state hint is not actionable — no link to the War Room

**Severity:** LOW
**File(s):** packages/client/src/features/party-map/party-map.tsx

## Problem

When the party-map is expanded with zero active quests, it renders:

```
No active quests — visit the War Room to start one.
```

The hint text mentions the War Room but provides no navigable element. The user must close the panel and remember to navigate to `/town/town-square` (and from there to the War Room building) manually.

`.claude/rules/ux-design-principles.md` ("What do I do next?") and `.claude/rules/ux-feedback.md` require empty states to include a call to action. `.claude/rules/common-findings.md` #5 also calls this pattern out.

## Expected

The empty-state should expose a clickable / keyboard-activatable affordance that takes the user to the War Room (or at least to `/town/town-square`).

## Fix

Replace the plain `<p>` with a button or link that navigates via `useNavigate()`. Keep the same parchment color tokens used elsewhere in the component. Example:

```tsx
{count === 0 ? (
  <div style={{ padding: '12px' }}>
    <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgb(190, 165, 110)' }}>
      No active quests.
    </p>
    <button
      type="button"
      onClick={() => navigate('/town/town-square')}
      style={{ marginTop: '8px', /* ...same parchment styling... */ }}
    >
      Go to Town Square
    </button>
  </div>
) : (
  /* ...rows... */
)}
```

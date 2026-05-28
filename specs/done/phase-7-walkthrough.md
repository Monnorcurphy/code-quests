# Phase 7 Walkthrough — PAUSED_INPUT & USER_BLOCKED Flow

A step-by-step demo script that confirms every feature of Phase 7 is reachable and working.

---

## Prerequisites

```bash
pnpm dev          # starts both server (port 4001) and client (port 5173)
```

---

## Step 1: Open the App

Navigate to `http://localhost:5173`.

**Expected state:** Town Square loads. If no adventurer exists, you see an empty roster.

---

## Step 2: Recruit an Adventurer

1. Click **Guild Hall** in the Town Square.
2. Click **Recruit Adventurer**.
3. Enter name (e.g. "Brielle"), select class "Champion", accept the default model.
4. Click **Recruit**.

**Expected state:** Adventurer appears in the Guild Hall roster. Town Square sidebar shows the adventurer name.

---

## Step 3: Draft a Quest

1. Click **War Room** in the Town Square.
2. Enter a title (e.g. "Fix the authentication bug").
3. Add a description and at least one acceptance criterion.
4. Click **Add Quest**.

**Expected state:** Quest appears on the Quest Board with "Idle" status.

---

## Step 4: Dispatch the Quest

1. From the Quest Board, click the quest to open the War Room detail view.
2. Click **Run Audit** — wait for "All checks pass".
3. Click **Dispatch Quest**.

**Expected state:** Quest dispatched. War Room shows the active quest panel with "Watch Quest" button.

---

## Step 5: Watch the Quest

Click **Watch Quest** in the War Room.

**Expected state:** Browser navigates to `/quest/<id>`. The Quest HUD appears with the Phaser side-scroller canvas below. Status shows "Active".

---

## Step 6: Observe PAUSED_INPUT — Bell + Parchment Modal

Within 1-2 seconds, the offline adapter emits a `paused_input` event.

**Expected state:**
- Status badge changes to "Awaiting Input".
- **Bell icon** appears in the top-right of the quest viewport, ringing (4 quick rotations then fade). Screen readers hear "Bell rings — attention needed."
- **Parchment modal** overlays the canvas: tan/brown background, serif font, title "The path forks…", and the question text below.
- The Phaser canvas dims underneath the modal.
- Focus moves to the reply textarea.

**Modal contents:**
```
The path forks…

[Adventure framing or raw question]

Your reply, my liege:
[textarea]                          [0/4000]

[Cancel quest]            [Send reply]
```

**Accessibility check:** Tab cycles within the modal only. ESC focuses the "Cancel quest" button. Screen reader announces the question text via `aria-live="assertive"`.

*Screenshot: parchment modal overlaying dimmed quest scene, bell icon top-right.*

---

## Step 7: Respond and Resume

1. Type a reply in the textarea (e.g. "Use approach A").
2. Click **Send reply**.

**Expected state:**
- Button shows "Sending…" while in flight.
- On success, the modal dismisses.
- Bell icon disappears.
- Quest resumes: "Active" status. The offline adapter continues with a combat event, then completes.
- Quest transitions to "Complete" and the Hall of Returns button appears.

*Screenshot: quest scene without modal, status "Active".*

---

## Step 8: Mark Self Blocked (Seek Counsel)

To test the user-blocked flow separately:

1. Create and dispatch a new quest (or reset an existing active quest).
2. Navigate to the quest page.
3. Click **Seek counsel** in the top-right HUD toolbar.

**Expected state:** A parchment dialog opens:
```
Seek Counsel

What are you waiting on?
[textarea]                     [0/1000]

[Cancel]          [Mark blocked]
```

4. Type a description (e.g. "Waiting for design review from the team").
5. Click **Mark blocked**.

**Expected state:**
- Dialog closes.
- Status badge changes to "Blocked".
- Bell rings and announces attention needed.
- **User-blocked modal** appears with parchment styling:
  ```
  Seeking counsel…

  [Adventure framing of the block description]

  [Edit description]          [Unblock]
  ```

*Screenshot: user-blocked modal with narrative framing.*

---

## Step 9: Unblock and Resume

Click **Unblock** in the user-blocked modal.

**Expected state:**
- Button shows "Resuming…" while in flight.
- Modal dismisses when WebSocket `status_change` to `active` arrives.
- Quest resumes (spawns a fresh agent run).
- Status returns to "Active" (or briefly "Awaiting Input" if the offline adapter immediately pauses again).

*Screenshot: quest scene without modal, status "Active".*

---

## Step 10: Verify Reduced-Motion Mode

In browser DevTools, enable `prefers-reduced-motion`:
1. Open DevTools → Rendering → Emulate CSS prefers-reduced-motion → reduce.
2. Trigger a pause (dispatch another quest or navigate to a paused quest).

**Expected state:**
- Bell icon appears but does NOT animate (no rotation/fade).
- `aria-live="assertive"` announcement still fires for screen readers.
- All other accessibility behavior unchanged.

---

## Accessibility Summary

Run `axe-core` scan (via Playwright test or browser extension) during each modal state:
- `paused_input` modal visible: **0 violations**
- `user_blocked` modal visible: **0 violations**
- No `text-gray-{100..400}` contrast-failing tokens present
- `aria-modal="true"` on both modals
- Focus trapped within modals; ESC handled
- `role="status"` with `aria-live` on modal body content

---

## Automated Verification

The E2E test `packages/client/tests/e2e/paused-input-flow.spec.ts` covers the full flows:

```bash
pnpm exec playwright test paused-input-flow.spec.ts
```

Both tests pass with zero axe-core violations.

# Phase 8 — Audio: Human Walkthrough

## What you hear and see from boot through a complete quest

### 1. Opening the app

When the browser loads `http://localhost:5173`, the Phaser town renders. At the bottom-left corner of the screen you'll see a small parchment-tinted badge that reads **"Town · Calm"** — this is the Scene Mood Indicator, always visible regardless of sound settings. As soon as you click anywhere or press a key, the Web Audio context unlocks and the **Town theme** begins to play: a calm, looping chiptune ambience that feels like a quiet medieval village at rest.

### 2. Dispatching a quest

Navigate to the War Room, draft a quest with acceptance criteria, and click **Dispatch Quest**. The moment you arrive on the quest route (`/quest/:questId`), two things happen simultaneously: the mood indicator transitions from "Town · Calm" to **"On the Road"**, and the audio crossfades — the town theme fades out over 400ms while the adventurous **Road theme** fades in. You feel the shift in tone instantly.

### 3. A monster appears

When the agent encounters a failure pattern the server classifies as a monster, a `monster_appeared` event streams over the WebSocket. The combat HUD appears in the quest scene. The mood indicator becomes **"In Combat"** and the **Combat theme** (tense, urgent chiptune battle music) crossfades in. For boss-tier monsters (Lich, Dragon), the indicator shows **"Boss Fight"** and the **Boss theme** escalates the tension further.

### 4. Defeating a monster

When the monster encounter resolves as a victory, a quick **Victory stinger** plays — a triumphant two-second flourish — and a toast banner appears at the top of the screen: **"Monster defeated!"** This banner auto-dismisses after 3 seconds. The underlying loop (Combat or Boss) continues playing while the stinger plays over it. After the encounter clears, the loop transitions back to Road theme if the quest continues.

### 5. Agent needs your input (PAUSE_BELL)

When the agent reaches a fork it can't resolve alone (`paused_input` status), two things happen at once: a distinct **bell tone** chimes and the screen edges briefly flash with a parchment-gold border (the Pause Bell flash). A screen reader hears "Bell — input requested" via the hidden `aria-live` announcer. The parchment modal appears with the agent's question, and the mood indicator remains unchanged — the road loop keeps playing quietly beneath the pause.

### 6. Quest complete or failed

On `quest.status === 'complete'`, a full **Victory fanfare** plays (longer than the monster stinger), a toast reads **"Quest complete!"**, and the audio returns to the Town theme. On failure, a **sombre stinger** plays, and the **"Quest failed — returned to town"** toast remains on screen until the user dismisses it (it does not auto-dismiss, per the error persistence rule). Audio also returns to the Town theme.

### 7. Silent Mode and Mute

Open the ⚙ Settings button (top-right corner). The settings panel offers:
- **Mute** — a toggle switch that silences the active backend without stopping it; flip it back and audio resumes from the same point in the track.
- **Silent Mode** — swaps the backend for a no-op implementation. No audio plays at all, but every visual cue — the mood indicator, pause bell flash, stinger toasts, and aria-live announcements — continues to fire. The experience is identical for users who cannot or choose not to use sound.
- **Master Volume** — a 0–100% range slider with a live numeric label.

### 8. Credits

From the Settings panel, click **Credits** to see a table listing every audio file shipped with Phase 8, its author, and its license. All files in this phase are CC0 placeholder tones (self-generated) — no attribution is required, but they are documented here for provenance. The table rows have `data-testid` attributes so the Playwright E2E test can assert coverage.

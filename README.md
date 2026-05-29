# Code Quests

A 2D pixel-art side-scroller web app that turns AI agent work into a medieval D&D fantasy adventure game.

## Getting started

```bash
# Install dependencies (Node 18+ required)
pnpm install

# Start the dev servers (client + server run in parallel)
pnpm dev
```

The client runs at `http://localhost:5173` and the server at `http://localhost:4001`. The Vite dev server proxies API calls, so you only need to visit the client URL.

The browser opens to `/town/town-square` — the pixel-art Phaser town.

## What you'll see (Phase 2)

### Pixel-art Town

The app launches into a 2D side-scroller **Town Square** built with Phaser 3. Your adventurer can walk left and right through the scene. Seven building doors lead to distinct rooms.

```
Town Square (3200px wide)
├── [Door] War Room      — Quest drafting & planning table
├── [Door] Oracle        — Acceptance Criteria (Phase 3)
├── [Door] Library       — Context & Bestiary (Phase 10)
├── [Door] Tavern        — Edge Cases (Phase 3)
│   [Quest Board]        — View drafted quests
│   [Recruit Banner]     — Recruit adventurers
├── [Door] Armory        — Equipment loadout (Phase 3)
├── [Door] Guild Hall    — Adventurer roster
└── [Door] Hall of Returns — Post-quest retrospective (Phase 9)
```

### Keyboard navigation

| Key | Action |
|---|---|
| `←` / `→` or `A` / `D` | Walk left / right |
| `Enter` / `Z` | Interact with highlighted object or door |
| `Tab` | Cycle through screen-reader nav items (hidden but accessible) |
| `Escape` | Close open HUD overlay |

### Scene transitions

Walking into a door fades the current scene and loads the building interior. The URL stays synced (`/town/war-room`, `/town/guild-hall`, etc.) — browser back/forward works.

### HUD overlays

Interacting with in-scene objects opens React modals layered over the canvas:

- **Quest Board** → view all drafted quests
- **Recruit Banner** → recruit a new adventurer
- **Planning Table** (War Room) → draft a new quest
- **Guild Roster** (Guild Hall) → view/recruit adventurers

### Settings

The ⚙ button in the top-right opens the settings panel:

- **Reduce motion** — disables scene fade transitions. Preference persists across reloads (localStorage).

To toggle reduce motion from the command line (for testing):
```bash
# In browser console:
localStorage.setItem('code-quests:reduced-motion', 'true')
location.reload()
```

## Phase 1 features (still available)

### Recruit flow

1. Walk to the **Recruit Banner** in Town Square → press Enter (or click "Recruit Banner" in the hidden nav)
2. Fill in name and class → submit
3. Adventurer appears in the Guild Hall roster

### Quest draft flow

1. Walk into the **War Room** → walk to the Planning Table → press Enter
2. Enter a title, description, and acceptance criteria
3. Click **Draft Quest** → quest appears on the Quest Board

### Persistence

Reload the browser — adventurers and quests persist (SQLite at `~/.code-quests/db.sqlite`).

## Seed data (optional)

```bash
pnpm --filter=@code-quests/server tsx src/scripts/seed-dev.ts
```

Creates 1 epic, 1 adventurer, and 2 quests.

## Development

```bash
pnpm build        # build all packages
pnpm test         # run all unit tests (Vitest)
pnpm test:e2e     # run E2E tests (Playwright)
pnpm lint         # run ESLint
pnpm typecheck    # run TypeScript type checks
pnpm check:assets # verify all asset licenses are recorded
```

## Tech stack

- **Frontend:** TypeScript + React + Vite
- **Game engine:** Phaser 3 (pixel-art side-scroller)
- **State:** Zustand + TanStack Query
- **Backend:** Node + Express
- **Database:** SQLite via better-sqlite3
- **Package manager:** pnpm workspaces

## Accessibility

The Phaser canvas is opaque to screen readers. A visually-hidden `<nav aria-label="Scene interactions">` mirrors every in-scene interactive as a button — keyboard and screen-reader users can reach all functionality without touching the canvas.

## Phase 4 walkthrough

Phase 4 introduces the full quest-execution pipeline: spawn an agent subprocess, stream progress live, and inspect the result in the Hall of Returns.

### Offline demo (no API key required)

The default configuration uses the **offline adapter** — a deterministic event sequence that simulates a real agent run without spending any tokens.

```bash
# Start both servers
pnpm dev

# Seed demo data (idempotent — required for the walkthrough below)
pnpm --filter=@code-quests/server tsx src/scripts/seed-dev.ts
```

Then in the browser at `http://localhost:5173`:

1. **Town Square** — walk to the Quest Board banner and press Enter (or click "Quest Board" in the hidden nav)
2. Select "Phase 4 Demo: Notify users on quest completion" → War Room opens
3. Click **Run Audit** → all checks should pass
4. Click **Dispatch Quest** → the adventurer sets out
5. The **Active Quest Panel** streams live events (progress, combat, completed)
6. Once complete, click **Return to Hall of Returns**
7. The quest appears under "Victorious" — click it to see the full combat log

### Using real Claude Code (optional)

Set two environment variables before starting the server:

```bash
# Enable real agent (Claude Code subprocess)
export CODE_QUESTS_USE_REAL_AGENT=1

# Optional: path to claude binary if not on PATH
export CODE_QUESTS_CLAUDE_BIN=/usr/local/bin/claude

pnpm dev
```

The ANTHROPIC_API_KEY must be set in your environment for the real adapter to authenticate.

### Cancellation

During an active quest, a **Cancel quest** button appears in the War Room. Clicking it opens a confirmation dialog. On confirm, the agent subprocess receives SIGTERM, the quest transitions to `failed` with recommendation `retire`, and the result appears in the Hall of Returns under "Returned in Defeat."

## Phase 5 — Quest Scenes

Phase 5 introduces **Quest Mode**: a 2D side-scroller that plays when a quest is dispatched. The adventurer traverses four scenes (Forest → Cave → Dungeon → Boss Chamber), driven by live WebSocket events from the server-side agent.

### What's new in Phase 5

- **Four quest scenes** with CC0/CC-BY pixel art: Forest path, Cave, Dungeon corridor, Boss chamber
- **`/quest/:questId` route** with a HUD overlay (title, adventurer name, status badge, connection chip, combat log, Return to Town button)
- **Scene progression**: player walks right to advance scenes, or server-driven `scene_change` events auto-advance
- **Party Map** peek-overlay (top-right corner) — visible from any route; lists all active quests with their current scene; click a row to jump directly to `/quest/:questId`

### Phase 5 walkthrough

```bash
pnpm install && pnpm dev
```

Then in the browser at `http://localhost:5173`:

1. **Town Square** — The Party Map shows the seeded demo quest "Phase 5 Demo: Cave Expedition" in the Cave
2. Click the Party Map row → navigates to `/quest/:questId`
3. The cave scene renders with Brielle the Bold
4. Press and hold `ArrowRight` — the adventurer walks right; at the edge the scene advances to Dungeon
5. Walk to the Dungeon right edge → Boss Chamber renders (terminal scene — no further advance)
6. Click **Return to Town** → returns to your last town scene; the Party Map still lists the quest

### Enter Quest from the Quest Board

Active quests in the Quest Board (Town Square banner) now show an **Enter Quest** button alongside the quest name, navigating directly to the quest scene.

### Watch Quest from the War Room

Opening an active quest in the War Room shows a **Watch Quest** button. For idle quests, the button is disabled with a "Dispatch first" tooltip.

## Phase 6 — Monsters

Phase 6 introduces the **Monster system**: combat encounters, the Bestiary, and Nemesis promotion.

### What's new in Phase 6

- **10 built-in MonsterTypes** — Goblin (lint), Imp (TypeScript error), Wraith (flaky test), Ogre (failing test), Hydra (AC mismatch), Mimic (silent failure), Wizard (env/dep), Troll (build fail), Lich (repeated failure), Dragon (epic obstacle)
- **Monster detection** — when an agent emits a `combat` event, the server classifies the message against failure signatures and records a `MonsterEncounter` in the DB
- **Lich aggregator** — after 3 encounters of the same monster type in a single quest attempt, a ★5 Lich automatically rises alongside the base monsters
- **Quest HUD combat layer** — monster sprite, HP bar, star rating, and scrolling combat log render in the Quest scene
- **Bestiary** in the Library — browse all monsters encountered, sorted by any column, filtered by Project vs. Guild scope
- **Nemesis promotion** — click "Mark as Nemesis" on any project monster to elevate it to a guild-scope Nemesis that persists across all future quests
- **Demo seed** — pre-built quest with Imp, Goblin, Wraith, and Lich encounters ready to browse in the Bestiary

### Phase 6 walkthrough (demo mode)

```bash
pnpm install && pnpm dev
```

In a second terminal, seed the Phase 6 demo data (idempotent):

```bash
pnpm --filter=@code-quests/server exec tsx src/scripts/seed-demo-quest.ts
```

Then in the browser at `http://localhost:5173`:

1. **Town Square** — walk to Quest Board or click "Quest Board" in the hidden nav
2. Find "Phase 6 Demo: Banish the TypeScript Poltergeist" → click "View quest"
3. The quest is already complete — scroll the War Room to see the combat history
4. Click **Library** door (or press Enter near it) → Library opens to **Bestiary** tab
5. The Bestiary shows four monsters: Imp (×3), Goblin, Wraith, and Lich
6. Click the Lich row → see the full encounter history; notice it appeared because the Imp triggered 3× (lich aggregator)
7. Click **Back to Bestiary**, then click the Imp row → click **Mark as Nemesis**
8. A modal shows the generated name — keep it or rename → click **Mark as Nemesis**
9. Success toast confirms promotion; the monster now shows ⚔ Nemesis badge
10. Switch to the **Nemeses (Guild)** tab in the Bestiary — the Imp appears there
11. Refresh the browser — monsters, encounters, and the new Nemesis all persist

### Replay a fresh quest with scripted failures

To run the full monster-detection pipeline without a real Claude Code subprocess:

```bash
# Ensure a fresh idle demo quest exists first
pnpm --filter=@code-quests/server exec tsx src/scripts/seed-demo-quest.ts

# Then replay the fixture (creates monsters + encounters in the DB)
pnpm --filter=@code-quests/server exec tsx src/scripts/replay-failures.ts
```

After the replay completes, open the Bestiary to see the freshly created monsters.

### Building the Library

- **Library scene** (`/town/library`): a Phaser building scene that auto-opens the Library modal
- **Bestiary** (`Library → Bestiary tab`): sortable table of all encountered monsters; click any row for details
- **Monster detail**: type, scope, difficulty stars, encounter history with quest titles
- **Nemesis modal**: confirm or rename before promoting; success auto-dismisses after 4 seconds

## Phase 8 — Audio

Phase 8 adds the full **audio layer** to Code Quests — ambient chiptune music that reacts to quest state, one-shot stingers for key moments, and full silent-mode parity so every sound has a visual equivalent.

### What's new in Phase 8

- **Town theme** plays on the town screen; **Road theme** plays when on a quest route; **Combat theme** and **Boss theme** respond to monster encounters
- **Pause Bell** rings (and flashes the screen edge) when the agent needs user input (`PAUSED_INPUT` / `USER_BLOCKED`)
- **One-shot stingers**: Victory flourish on monster defeat, fanfare on quest complete, sombre stinger on failure
- **Scene Mood Indicator** (bottom-left corner) shows the current audio mood in text — visible even with sound off
- **Stinger toasts** announce each audio event as a dismissable banner
- **Mute toggle** — silences output but keeps audio playing; unmute resumes mid-track
- **Silent Mode** — swaps to a no-op backend; every cue remains visible via the mood indicator and toasts
- **Master Volume** slider (0–100%) with live label
- **Credits screen** (Settings → Credits) — lists every audio file with author and license

### Audio controls (Settings → ⚙)

| Control | What it does |
|---|---|
| **Mute** | Silences playback; toggle off to resume mid-track |
| **Silent Mode** | Disables all audio, activates visual-only cues |
| **Master Volume** | 0–100% volume slider |

All three settings persist across reloads (localStorage, key `code-quests.audio`).

### Troubleshooting audio

- **No sound on first load**: browsers block autoplay until the user interacts with the page. Click anywhere or press any key to unlock audio.
- **Strict CSP blocking audio**: if your environment has a Content-Security-Policy that restricts `media-src`, the Web Audio `fetch()` calls will fail silently. Enable Silent Mode or relax `media-src` to allow `self`.
- **Placeholder audio files**: Phase 8 ships with self-generated placeholder tones. Swap in real CC0/CC-BY tracks by replacing files under `packages/client/public/audio/` — no code changes required (the manifest in `packages/client/src/audio/asset-manifest.ts` is the single source of truth for paths).

## Phase 9 walkthrough — Failure loop

Phase 9 closes the quest failure loop: failed quests are automatically returned to the **Hall of Returns**, where you can review the combat log, leave feedback, and choose a remedy.

### What's new in Phase 9

- **Automatic failure capture** — when a quest agent exits non-zero or exhausts its retry budget, the `quest-failure-detector` automatically transitions the quest from `failed` → `returned_to_town` and synthesises a `FailureSummary`
- **Hall of Returns** (`/town/hall-of-returns`) — two tabs: Returned (quests awaiting action) and Completed (victorious quests); live badge in Town Square when ≥1 quest is waiting
- **Post-mortem panel** — per-quest view with scrollable combat-log replay, failure summary card showing the recommendation, and a feedback textarea (1–2000 chars, validated)
- **Three remedy actions** — Re-post (with adjustments), Retire (permanent, confirmation required), Break into Smaller (≥2 child quests)
- **Scars** — when an adventurer fails in a repeatable pattern, a `ScarRecord` is appended to their profile; the Guild Hall roster shows a "Scars (N)" badge that expands to link back to the originating post-mortems
- **Scar-aware auto-match** — the auto-match scoring function subtracts 15 points per matching scar (capped at −30), so scarred adventurers are nudged away from quests that match their failure pattern

### Human walkthrough (with seed data)

```bash
pnpm install && pnpm dev

# In a second terminal:
pnpm --filter=@code-quests/server seed:phase9
```

1. **Town Square** — walk to the Quest Board and open it (press Enter / click "Quest Board"). A red "📜 1 quest returned" badge appears near the Hall of Returns link.
2. Click the badge (or walk to the Hall of Returns door and press Enter) → list view opens, "Returned" tab active, showing the seeded quest "Migrate the payment gateway integration".
3. Click the quest row → post-mortem panel loads:
   - **Combat log** replays the two Hydra (AC mismatch) encounters
   - **Failure summary card** shows recommendation: "Re-post with clarification"
   - **Feedback textarea** (labelled "Your feedback") with live char counter
4. Type feedback ("ACs were too vague — specify which flows count as end-to-end") → click **Submit Feedback** → success toast appears and auto-dismisses after 3s.
5. Click **Re-post** (shown with "Recommended" badge) → dialog opens with original ACs pre-filled → tighten one AC → click **Re-post Quest** → toast "New quest posted: …" with link to the new quest.
6. Auto-match the new quest → "Vance the Scarred" scores lower (scar penalty −15 logged as `scarPenalty: -15`).
7. Navigate to **Guild Hall** → Vance's roster row shows "Scars (1)" badge → click it → scar entry links back to the post-mortem.
8. Return to **Hall of Returns** → switch to "Completed" tab → empty state ("No completed quests yet — the guild has been victorious").
9. Open the original returned quest → click **Retire** → confirmation dialog → confirm → toast "Quest retired" → quest disappears from the Returned tab.

### Automated E2E

```bash
pnpm test:e2e --grep "Phase 9"
```

The Playwright spec (`packages/client/tests/e2e/phase-9-capstone.spec.ts`) mocks the API and walks through the key interaction paths, including axe-core accessibility scans on every Phase 9 surface.

---

## Phase roadmap

| Phase | Status | Content |
|---|---|---|
| 1 | Done | Recruit + draft + Quest Board (HTML) |
| 2 | Done | Pixel-art Phaser town, 8 scenes, HUD overlays, settings |
| 3 | Done | Oracle, Tavern, Armory, dispatch flow |
| 4 | Done | Agent subprocess adapter, WebSocket stream, Hall of Returns |
| 5 | Done | Quest scenes, scene progression, Party Map, quest HUD |
| 6 | Done | Monster system, Bestiary, Lich aggregator, Nemesis promotion |
| 7 | Done | PAUSED_INPUT modal, user-blocked flow, Pause Bell |
| 8 | Done | Audio layer — ambient themes, stingers, silent mode, credits |
| 9 | Done | Hall of Returns, post-mortem, re-post / retire / split, scars, failure loop |
| 10 | Done | Skills learning loop, Library hub, user-defined MonsterTypes, Armory chip |

## Phase 10 walkthrough

Phase 10 completes the self-improvement loop: the app watches which monsters the adventurer defeats, proposes skills, and the user confirms or dismisses them. Confirmed skills are available in the Armory for every future quest.

### Quick demo (Phase 10)

```bash
# Install dependencies and start dev servers
pnpm install && pnpm dev

# Seed Phase 10 demo data (idempotent)
pnpm --filter=@code-quests/server tsx src/scripts/seed-dev.ts --phase-10-demo
```

Then in the browser at `http://localhost:5173`, follow these 8 steps:

1. **Town Square** — A gold "Library has news" ribbon appears at the top of the Town Square panel, linking to the Library Skills tab.
2. **Click the ribbon** — The Library modal opens with the **Skills** tab auto-selected. One candidate card is visible: "Auto: Goblin (Linter)" (auto-detected after 3 victorious encounters).
3. **Confirm the skill** — Click **Confirm Skill** on the candidate card. An inline form opens; leave defaults or rename the skill and submit. A success toast appears. The card disappears from Candidates and "Goblin Linter Slayer" (or your chosen name) appears in the **Unlocked Skills** section.
4. **Close the Library** — The ribbon in Town Square is now gone (you've opened the Library and resolved all candidates).
5. **Walk to the Armory** — Open the Loadout for any quest. A green **🔓 New skill available** chip appears next to the Skills section heading. Click the chip — the panel scrolls to the first unequipped skill, highlighted in green. Check it, then click **Save Loadout**.
6. **Coin New Type** — From the Bestiary tab, click **+ Coin New Type**. In the modal, enter name "Slug", signature `eslint.*max-len`, choose any sprite, and submit. A success toast confirms creation. The Bestiary list updates (no encounters yet, but "Slug" now appears in the Forge Skill and Coin Type dropdowns).
7. **Forge Skill manually** — Click any monster in the Bestiary list → click **⚒ Forge Skill** on its detail page → fill in the skill form and submit. The new skill appears in the Skills tab under Unlocked Skills.
8. **Accessibility** — All four key surfaces (Library Bestiary, Library Skills, Coin New Type modal, Armory Loadout) pass `axe-core` with zero violations.

### Automated E2E

```bash
pnpm test:e2e --grep "Phase 10"
```

The Playwright spec (`packages/client/tests/e2e/phase-10-capstone.spec.ts`) mocks the API and walks through the key interaction paths, including axe-core scans on every Phase 10 surface.

See also: `specs/done/phase-10-walkthrough.md` for the full prose walkthrough.

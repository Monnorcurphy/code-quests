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

## Phase roadmap

| Phase | Status | Content |
|---|---|---|
| 1 | Done | Recruit + draft + Quest Board (HTML) |
| 2 | Done | Pixel-art Phaser town, 8 scenes, HUD overlays, settings |
| 3 | Done | Oracle, Tavern, Armory, dispatch flow |
| 4 | Done | Agent subprocess adapter, WebSocket stream, Hall of Returns |
| 5 | Done | Quest scenes, scene progression, Party Map, quest HUD |
| 6 | Done | Monster system, Bestiary, Lich aggregator, Nemesis promotion |
| 9 | Future | Re-post / Retire buttons, feedback loop |
| 10 | Future | Skills learning loop; user-defined MonsterTypes |

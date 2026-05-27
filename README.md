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

## What you'll see

### Town Square

The entry point. When you open the app you land on **The Town** — a grid of 8 buildings, each with a distinct purpose:

| Building | Purpose |
|---|---|
| Town Square | Entry & Recruiting — assemble your guild |
| War Room | Draft quests (title, description, acceptance criteria) |
| Oracle | Acceptance Criteria (Phase 2+) |
| Library | Context management (Phase 2+) |
| Tavern | Edge cases (Phase 2+) |
| Armory | Equipment / loadout (Phase 2+) |
| Guild Hall | Adventurer management |
| Hall of Returns | Post-quest retrospective (Phase 2+) |

### Recruit flow

1. Click **Town Square** → a panel opens showing the Quest Board and your roster
2. Click **Recruit an Adventurer** → fill in name and class → submit
3. The new adventurer appears in the roster immediately

### Quest draft flow

1. Click **War Room** → the draft form opens
2. Enter a title (required), description (optional), and acceptance criteria
3. Optionally choose an epic from the dropdown
4. Click **Draft Quest** → the quest appears on the Quest Board with a "Drafted" badge

### Persistence

Reload the browser — adventurers and quests persist (SQLite at `~/.code-quests/db.sqlite`).

## Seed data (optional)

To pre-populate the DB with demo data:

```bash
pnpm --filter=@code-quests/server tsx src/scripts/seed-dev.ts
```

This creates 1 epic, 1 adventurer, and 2 quests.

## Development

```bash
pnpm build        # build all packages
pnpm test         # run all unit tests
pnpm lint         # run ESLint
pnpm typecheck    # run TypeScript type checks
```

## Tech stack

- **Frontend:** TypeScript + React + Vite
- **Backend:** Node + Express
- **Database:** SQLite via better-sqlite3
- **State:** TanStack Query
- **Package manager:** pnpm workspaces

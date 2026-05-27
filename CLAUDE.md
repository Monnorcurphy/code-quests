# Code Quests — Agent Instructions

This is **Code Quests**: a 2D pixel-art side-scroller web app that turns AI agent work into a medieval D&D fantasy adventure game.

**Read `specs/founding-document.md` for the full product vision.** It is the single source of truth.

## Tech stack

- **Frontend:** TypeScript + React + Vite
- **Game engine:** Phaser 3 (for both Town and Quest 2D scenes)
- **State:** Zustand
- **Backend:** Node + Express
- **DB:** SQLite via better-sqlite3
- **Audio:** Web Audio API + bundled CC0 chiptune tracks (no third-party iframe)
- **Art:** Free pixel art (Kenney.nl CC0, 0x72 Dungeon Tileset II CC-BY)
- **Tests:** Vitest + Playwright
- **Realtime:** WebSocket (server → browser quest state)
- **Package manager:** pnpm

## Project structure (target)

```
packages/
  server/      # Express API + SQLite + agent orchestration + WebSocket
  client/      # React + Phaser web app
  shared/      # TypeScript types shared across server/client
assets/
  CREDITS.md   # All third-party asset licenses recorded here
specs/         # Founding doc + per-phase specs (generated)
factory/       # Profile + factory-managed files
```

(Monorepo via pnpm workspaces. Phase 1 sets this up.)

## Key concepts (must internalize)

- **Town** = planning. Buildings have discrete purposes (War Room = description, Oracle = ACs, Library = context, Tavern = edge cases, Armory = equipment, Guild Hall = adventurer, Hall of Returns = post-quest, Town Square = entry/recruiting).
- **Quest** = the adventure. 2D side-scroller scenes (forest → cave → dungeon → boss). Adventurer walks left-to-right; monsters appear in path.
- **Adventurer** (persistent, global across projects) vs **Agent** (ephemeral subprocess, dies per quest). Don't conflate them.
- **Equipment** = per-quest loadout = `{ skillIds, toolIds, mcpServerIds }`. Skills are global; equipment is the bundle chosen for one quest.
- **Monsters:** three layers — `MonsterType` (category), `Monster` (named instance with `scope: project | guild`), `MonsterEncounter` (per-quest combat).
- **Nemesis** = a guild-scope named Monster that follows the user across projects.
- **Blockers** are first-class: `PAUSED_INPUT` (agent needs user) and `USER_BLOCKED` (user marks self blocked). Both freeze the UI and surface as narrative obstacles in the scene.

## Design constraints

- **2D side-scroller, fixed camera per scene.** No follow-cam. Touchstones: Darkest Dungeon, classic JRPG battle screens, Castlevania, Shovel Knight.
- **All art and audio assets must be CC0 or CC-BY**, recorded in `assets/CREDITS.md`. No in-house art generation.
- **Accessibility is first-class.** Every audio cue needs a visual parallel. Keyboard-navigable. Screen-reader summaries. Reduced-motion mode.
- **Local-first.** SQLite on the user's machine. No cloud sync in v1.
- **API keys via OS keychain**, never in DB.

## Phase plan

See §15 of `specs/founding-document.md`. 11 phases, Phase 11 is the capstone (end-to-end demo).

## Self-improvement loop

Repeated monster types defeated the same way → propose a skill candidate → user confirms in the Library → unlock for all future quests. The product gets easier the more it's used.

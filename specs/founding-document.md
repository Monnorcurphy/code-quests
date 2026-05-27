# Code Quests — Founding Document

> Single source of truth for building Code Quests.
> `slice-spec.sh` will extract per-phase sections; agents read those, not this whole doc.

**Founders:** Connor Murphy, Ryan
**Created:** 2026-05-26
**Status:** Pre-Phase 1 (spec)

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [The Two Modes: Town & Quest](#2-the-two-modes-town--quest)
3. [Quest Hierarchy: Epics → Stories](#3-quest-hierarchy-epics--stories)
4. [Obstacles as Monsters](#4-obstacles-as-monsters)
5. [Skills & Equipment (The Learning Loop)](#5-skills--equipment-the-learning-loop)
6. [Adventurers (Agent Classes)](#6-adventurers-agent-classes)
7. [Audio Layer (Wario Synth)](#7-audio-layer-wario-synth)
8. [Quest Lifecycle](#8-quest-lifecycle)
9. [User Stories](#9-user-stories)
10. [Data Model](#10-data-model)
11. [UI / UX](#11-ui--ux)
12. [Tech Stack](#12-tech-stack)
13. [Security & Privacy](#13-security--privacy)
14. [Non-Goals](#14-non-goals)
15. [Phase Overview](#15-phase-overview)

---

## 1. Product Vision

Code Quests turns running AI agents into a **fantasy adventure game**. Instead of staring at a spinner while an agent works, the user **goes on the quest with the adventurer** — watching the journey, helping when monsters block the path, and gathering skills that make future quests easier.

**The core insight:** today's agent UIs treat the work as invisible (terminal logs, status badges). The work has structure — exploration, friction, breakthroughs, setbacks — and that structure is naturally legible as a quest. A linter failure isn't a red X in a CI log; it's a **goblin** blocking the road. Defeat it once, learn its weaknesses, and the next adventurer carries the right weapon.

**Target user (v1):** software builders running multiple AI agents who want their work to feel *embodied* — like leading a party, not micromanaging a build pipeline.

**Core principles:**
- **The agent is the adventurer; the user is the patron-strategist.** The user plans and equips; the adventurer fights.
- **Town is for planning; quests are for doing.** When you launch a quest, refinement is over. The adventurer is in the field.
- **Friction is content.** Lint errors, type errors, failing tests aren't background noise — they're monsters with names, weaknesses, and loot.
- **The game gets easier as it learns.** Repeated monsters become trivial once a skill is unlocked. The factory itself is the meta-game.
- **Audio is product.** Ambient questing music shifts on combat, on victory, on a pause that needs your input.

---

## 2. The Two Modes: Town & Quest

Code Quests has two primary modes, both rendered as **2D side-scroller scenes** with a **fixed camera** (no follow-cam — each scene is a stage you see all at once, like a classic JRPG battle screen or `Darkest Dungeon`). The aesthetic is **medieval fantasy** — stone-and-timber, parchment, torchlight, banners.

### Town Mode — planning

Town is a side-scrolling medieval village. Each building has a **discrete purpose** — and crucially, each maps to a specific *category* of missing information in a quest. When a quest's spec audit flags something missing, the app tells the user **which building to visit** to fix it.

| Building | Purpose | Fills this gap in a quest |
|---|---|---|
| **The Town Square** | Central plaza. Entry point to town. Spawn new adventurers here. Quest Board is mounted on a wall. | (general navigation; adventurer creation) |
| **The War Room** | Draft quests, write descriptions, break epics into stories | Missing title / description / story breakdown |
| **The Oracle** (Sage's hut) | Refine acceptance criteria — "what does done look like?" | Missing or vague acceptance criteria |
| **The Library** | Research the codebase, gather context, browse past quests + bestiary | Missing context / unfamiliar terrain |
| **The Tavern** | Adventurers share tales of past quests — surface edge cases and gotchas | Missing edge cases / "what could go wrong" |
| **The Armory** | Equip the quest — pick skills, tools, MCP servers the adventurer will carry | Missing equipment loadout |
| **The Guild Hall** | Roster of adventurers, their classes, scars, specializations; assign or override auto-match | Missing adventurer assignment (rare — defaults to auto-match) |
| **The Hall of Returns** | Completed and failed quests; review combat logs; re-post or retire | (post-quest review) |

The **Town Square** is the front door — it's the first scene the user lands in, and the Quest Board is here. From the Square, the user can walk left/right to enter the other buildings. New adventurer recruitment also happens in the Square (a recruiting banner / hiring table).

Town is **calm**. Refinement, scoping, AC changes, equipment swaps — all town activities. Once a quest leaves town (gets claimed), the AC is locked.

**Spec-audit routing:** before a quest can be dispatched, a fast preflight (haiku-level) reads the quest and flags any building it's underspecified for. The user sees: *"This quest has no ACs — visit the Oracle"* or *"No edge cases noted — drop by the Tavern"*. They can dismiss the warning and dispatch anyway (the system records they bypassed) or click the warning to teleport to that building.

### Quest Mode — the adventure

When a quest launches, the UI shifts to **Quest Mode**: a 2D side-scrolling adventure, fixed camera per scene. The adventurer walks left-to-right across each scene; when they reach the edge, the scene transitions (forest → cave → dungeon → boss room). Monsters appear in their path; combat happens in place (Final Fantasy / Darkest Dungeon style — adventurer on one side, monster on the other, party-versus-enemy framing).

- **Scenes** are stages: a forest path, a cave mouth, a dungeon corridor, a boss chamber
- **Monsters** appear when the adventurer hits real friction (lint, type, test, AC failures)
- **Combat** plays out in the scene — visible animations, narrated combat log beneath
- The user can intervene when prompted (`PAUSED_INPUT`) — described in §8
- Multiple quests can be in progress; the user can swap between them via the **Party Map** (peek-overlay listing all active adventurers and what scene they're in)

The Town↔Quest switch is **explicit and felt** — animated transition, not a tab change. Walking out the town gate vs. returning to it.

---

## 3. Quest Hierarchy: Epics → Stories

```
EPIC                        (a campaign — large objective, multi-week-feeling)
 ├── STORY                  (a quest — single agent, single acceptance set)
 ├── STORY
 └── STORY
       └── OBSTACLES        (monsters — encountered mid-quest, not pre-planned)
```

- **Epics** are campaigns. They have a goal but no fixed AC at the top level. The user breaks them into stories during town planning.
- **Stories** are quests. Each story has its own acceptance criteria and is taken by a single adventurer (one agent). Stories are the atomic unit of execution.
- **Obstacles** are *not* pre-planned. They emerge during a quest. A type error a builder hit while implementing a feature is an obstacle. The agent fights it; if it can't, the obstacle escalates.

Epics can have **chain dependencies** between their stories. A story doesn't start until its predecessors are won.

---

## 4. Obstacles as Monsters

Every form of in-quest friction is a monster. Monsters are **classic D&D creatures** — goblins, wizards, hydras — each with a name, a type, and weaknesses.

| Monster | Real-world equivalent | Flavor / Weakness |
|---|---|---|
| **Goblin** | Lint error | Common pest; quick to kill once you have the **Linter's Bane** skill |
| **Imp** | Type error (TS / Rust) | Mischievous trickster; **Type Whisperer** skill banishes on sight |
| **Wraith** | Flaky test | Intermittent, hard to pin down; **Banish Flake** skill quarantines them |
| **Ogre** | Hard failing test | Brute force; the adventurer must out-think it — combat = rewrite or fix |
| **Hydra** | Acceptance criterion mismatch | Many heads; each AC must be satisfied; partial wins regrow heads |
| **Mimic** | Silent failure (passes tests, wrong behavior) | Looks like success, isn't; smoke-test skill or human verify reveals it |
| **Wizard** | Env / dependency / non-deterministic failure | Casts illusions ("works on my machine"); arcane and platform-specific |
| **Troll** | Stubborn build failure | Regenerates damage; needs the right element (proper tooling) to defeat |
| **Lich** | Repeated failure (3+ same obstacle) | Boss-tier, undying; triggers an Incident — quest returns to Town for gear review |
| **Dragon** | Epic-scale obstacle (genuinely hard problem) | Final boss; usually requires breaking the quest into smaller stories |

### Common monsters, Nemeses, and the bestiary

Two scopes of monster identity:

- **Common monsters** (slimes, goblins, imps, etc.) represent **categories of friction** — lints, typechecks, flaky tests. They appear in any project that has the matching failure pattern. They're not "the same slime" across projects; they're "this project's slime of the day".
- **Nemeses** are **named, cross-project recurring foes**. A nemesis is something the user (or system) has identified as a *personal* repeating obstacle: "Grognak" the type-error goblin that haunts their work, or "Karen the PM" who keeps blocking releases. A nemesis follows the user across projects, with cumulative reputation: encounters, defeats, escapes, last-seen, average TTK.

Three data layers:

1. **MonsterType** — category template (Goblin, Imp, Wizard, Slime, or user-coined). Sprite + default difficulty + failure-pattern signature.
2. **Monster** — a *named* instance with a **scope**: `project` (a common slime in this project) or `guild` (a cross-project nemesis like Grognak). User can promote a project monster to a guild nemesis by naming it.
3. **MonsterEncounter** — a single combat event in a specific quest, referencing the Monster.

The bestiary is **user-extensible**: define a new MonsterType (name + sprite + failure-pattern signature) and the system will recognize that pattern in future quests.

**Difficulty** is on both the type (baseline) and the named monster (calibrated from real combat data). Library displays: "Grognak: ★★ (easy)", "the Hydra of Auth: ★★★★★ (deadly)".

When a monster is **defeated**, it can drop **loot**: a new skill candidate, an equipment unlock (a new tool/MCP integration the agent learned to wield), or XP/insight logged to the Library.

---

## 5. Skills & Equipment (The Learning Loop)

This is the **self-improvement engine**. The product gets better the more it's used.

### The model

- **Skills** are **global, persistent capabilities** the guild has learned. Once a skill is unlocked, it can be equipped on *any* quest by *any* adventurer. Skills are the long-term memory of the system. **No class restrictions** — if a Scout wants to equip a Dragon-slayer skill, they can. Unwise, perhaps, but allowed.
- **Equipment** is the **per-quest loadout** — the bundle of skills + tools + MCP servers the adventurer carries on a specific quest. Equipment is attached to the **quest**, not to the agent. (Different quest, different loadout.)
- **Tools** and **MCP servers** are also forms of equipment. A skill is one type of equipment; an installed CLI tool is another; an MCP integration is another. All three are things the adventurer can carry into a quest. If the guild owns a tool, any adventurer can wield it.

```
SKILLS (global library, unlocked once)         ──┐
TOOLS (CLI / scripts available to the guild)   ──┼──► EQUIPMENT (per-quest loadout)
MCP SERVERS (integrations available)           ──┘         │
                                                           ▼
                                                  carried by adventurer
                                                  on this specific quest
```

### Skills (global)

A skill is created when:

1. **The user explicitly forges one** ("I keep seeing eslint `no-unused-vars` — make a skill for this")
2. **The factory auto-detects a pattern** (same monster type defeated 3+ times the same way → proposes a skill candidate; user confirms or dismisses in the Library)

Examples:
- **Linter's Bane** — applies `npm run lint -- --fix` and resolves common Goblins before they engage
- **Type Whisperer** — runs typechecker iteratively, narrows Imp errors to root cause before fighting
- **Wraith-Banisher** — handles flaky tests by bisecting recent changes and quarantining the test
- **AC Cartographer** — generates a structured diff between current behavior and expected when a Hydra appears

### Tools and MCP Servers (also equipment)

- **Tools** — shell commands / scripts the guild has installed (`gh`, `jq`, project-specific scripts, etc.).
- **MCP Servers** — model context protocol integrations (filesystem, github, custom servers). An MCP server equipped on a quest is connected to the agent's session for the duration of that quest.

### Equipment (per-quest loadout)

When a quest is being prepped (in the **Armory**), the user picks the loadout:

```
Quest "Implement dark mode toggle" →
  equipment: {
    skills:       [linters_bane, type_whisperer]
    tools:        [pnpm, playwright_cli]
    mcpServers:   [filesystem, github]
  }
```

Auto-match picks a default loadout based on quest content; the user can swap in/out before dispatch.

### The Library (Skill Tree + Armory inventory + Bestiary)

The Library shows:
- All unlocked skills (with hit counts — how many monsters each has slain)
- All available tools and MCP servers
- Pending skill candidates (the factory has noticed a pattern; user confirms or dismisses)
- The bestiary — every monster ever encountered, named, with difficulty ratings and combat history

Skills learned in one project propagate to all projects — the guild gets stronger over time across everything they build.

---

## 6. Adventurers and Agents

Code Quests draws a sharp line between the **adventurer** (the persistent identity) and the **agent** (the ephemeral subprocess that does the work).

### Adventurer (persistent character)

An Adventurer is a named hero with a track record. Adventurers **live across quests** — they accumulate scars, victories, specializations. The user creates new adventurers from the Town Square and they show up in the Guild Hall roster.

Each adventurer has:
- **Name** (user-given or generated, e.g., "Brielle the Bold")
- **Class** (fixed at creation; see below)
- **Stats** (quests won/lost, monsters slain by type, average TTK)
- **Specializations** (emergent tags — the adventurer that keeps slaying Hydras gets `hydra-slayer`)
- **Scars** (notable past failures — the quests they couldn't finish; informs auto-match)

### Agent (ephemeral subprocess)

When an Adventurer takes a quest, the system spawns an **Agent** — a single subprocess (e.g., `claude code` invocation) running *as* that Adventurer for the duration of the quest. The agent:

- Inherits the equipment loadout of the quest
- Streams events (progress, combat, paused_input) back to the UI
- **Dies when the quest ends** — completed, failed, or returned

Agents are not reused. The Adventurer identity persists; the agent body is reborn each quest. If the same Adventurer takes a follow-up quest, a fresh agent is spawned.

### Classes

| Class | Default model mapping | Best for |
|---|---|---|
| **Champion** | Claude Opus | Hard, ambiguous, multi-file quests; bossfights (Dragons, Liches) |
| **Ranger** | Claude Sonnet | Standard feature work; balanced cost/capability |
| **Scout** | Claude Haiku | Small, well-scoped quests; spec audits; cheap |
| **Rogue** | codex / cheap-fast | Refactors, mechanical edits |
| **Apprentice** | (configurable) | Bug triage, monster identification |

Model bindings are configurable — a user can map a class to whatever model/provider they want.

### Spinning up adventurers

The **Town Square** has a recruiting banner. Clicking it opens a recruit modal: pick name, class, optional starting equipment loadout default. The new adventurer joins the Guild Hall roster.

**No progression gates. No costs.** Adventurers spawn freely. The user can recruit a Champion as their first hero. The only limit is the user's hardware — agents are real subprocesses and consume real RAM/CPU/tokens.

**Guild is global, not per-project.** Adventurers travel across all the user's projects. Stats, scars, and specializations accumulate across everything they've worked on. A Champion's track record from one project counts in auto-match decisions for another.

### Auto-match

**Default: ON.** When a quest is dispatched, the system auto-picks an adventurer based on:
- Quest size / complexity (description length, AC count, edge cases noted)
- Historical monster types in similar quests
- Adventurer track record + scars (don't send the apprentice into a Dragon's lair)
- Cost budget (if set)

The user can **override** at any time before dispatch — pick a specific adventurer in the Armory or Guild Hall.

The user can run **multiple adventurers in parallel**. Each runs their own quest in its own Quest scene; the Party Map switches focus between them.

---

## 7. Audio Layer

Audio reinforces what mode you're in and what's happening in a quest.

| Mode / Event | What plays |
|---|---|
| **Town theme** | Calm chiptune ambience — strategy music |
| **On the road** | Adventurous travel theme — quest in progress, no combat |
| **Combat** | Tense battle theme — adventurer is engaged with a monster |
| **Boss / repeated failure** | Boss theme — escalation, calls attention |
| **Victory stinger** | Short flourish when an obstacle is defeated |
| **Pause bell** | Distinct bell on `PAUSED_INPUT` or `USER_BLOCKED` — overrides current track briefly |
| **Quest complete fanfare** | Brief triumphant theme; back to Town theme |
| **Quest failed / return** | Sombre return theme; back to Town theme |

**Implementation: own it, don't depend.** Audio is delivered via the Web Audio API. **No iframe dependency on third-party hosted synths.** Content sources, in order of preference:

1. **Free CC0 chiptune tracks** from OpenGameArt — primary content for v1. Recommended sources:
   - **Juhani Junkala** — Chiptune Adventures (CC0; excellent RPG flavor)
   - **HorrorPen** — CC0 chiptune library
   - **Eric Matyas / Soundimage.org** — CC-BY (broader, more orchestral options)
2. **Procedural generation** via Tone.js — secondary path, added in a later phase when we want dynamic intensity (combat tension scaling, boss escalation).
3. (Optional, expendable) Wario Synth iframe — **not a dependency**. If we ever want to use it as a novelty audio mode, it can be wired in behind the `AudioBackend` interface. If `wario.style` disappears, nothing in Code Quests breaks.

`AudioBackend` is an interface; the default implementation plays pre-bundled CC0 tracks via Web Audio API. License compliance: each track recorded in `assets/CREDITS.md`.

**Accessibility:** every audio event has a parallel visual cue. A `MUTE` toggle and a `SILENT MODE` (visual-only, bell flashes the screen) are first-class settings, not afterthoughts.

---

## 8. Quest Lifecycle

```
DRAFTED → POSTED → CLAIMED → IN_PROGRESS ─┬─► COMBAT (monster encounter)
                                          │      │
                                          │      ├─► DEFEATED (back to IN_PROGRESS)
                                          │      ├─► FLED (back to town with notes)
                                          │      └─► PAUSED_INPUT (agent needs user)
                                          │
                                          ├─► USER_BLOCKED (user-marked blocker)
                                          ├─► COMPLETED
                                          └─► FAILED → RETURNED_TO_TOWN
```

**State definitions:**
- `DRAFTED` — in town; user composing
- `POSTED` — on the Quest Board, available
- `CLAIMED` — adventurer has taken it
- `IN_PROGRESS` — adventurer is traveling/working
- `COMBAT` — actively fighting a monster (lint/type/test failure, etc.)
- `PAUSED_INPUT` — **agent-initiated block**: adventurer needs user input (a question, a secret, a decision). Bell rings; quest view freezes on the current frame; user must acknowledge before action resumes.
- `USER_BLOCKED` — **user-initiated block**: user says "I need to do something before this can continue" (e.g., talk to a colleague, get an approval, write a design doc). Quest pauses with a narrative-framed banner; user resolves and unblocks themselves to resume.
- `COMPLETED` — all ACs met; victory
- `FAILED` — retry budget exhausted or fatal obstacle
- `RETURNED_TO_TOWN` — failed quest is back; user reviews combat log + failure summary, then either re-posts (with adjustments) or retires

**The "UI doesn't update" rule:** during `PAUSED_INPUT` and `USER_BLOCKED`, the quest's main view freezes its visual state so the user can read the prompt without animation chrome distracting. Background data still streams (so resume is instant), but the visual layer is locked until acknowledged.

### Blockers in adventure language

Both `PAUSED_INPUT` and `USER_BLOCKED` surface in the Quest scene as **in-world obstacles** — not modal error dialogs. Examples:

| Real-world situation | Adventure framing |
|---|---|
| Agent needs an API key | "Brielle has reached a sealed door. She needs the runed key (the API key) to enter." |
| Agent needs a decision between two approaches | "The path forks. The Sage asks which road you'd have her take: the woodland trail or the mountain pass?" |
| User realizes they need a design review | "You sense the village elder must be consulted before this quest can continue. Mark yourself as seeking counsel." |
| User waiting on external approval | "A messenger has been sent to the king's court. Until they return with word..." |

The UI provides a **"mark yourself blocked"** button on any in-progress quest; clicking it opens a parchment dialog where the user writes what they're waiting on. The factory translates the user's plain text into adventure framing for the scene. The user can return at any time, click **"unblock"**, and the quest resumes.

Blockers (both kinds) are first-class — tracked in metrics, can be summarized in retrospectives ("you spent 4 hours waiting on external approvals this week").

---

## 9. User Stories

### Town (planning)
- **US-1:** As a user, I open Code Quests into the **Town Square** and see active adventurers, the Quest Board, and entry points to all other buildings.
- **US-2:** As a user, I draft a new quest in the **War Room** by writing a description and choosing whether it's a story or an epic (epic = break into stories).
- **US-3:** As a user, when I try to dispatch a quest, the spec audit tells me what's missing and **which building to visit** to fix it (e.g., "vague ACs → Oracle", "no edge cases → Tavern", "no equipment → Armory").
- **US-4:** As a user, I can edit/refine a quest's ACs while it is in town (`DRAFTED` or `POSTED`). Once `CLAIMED`, ACs are locked.
- **US-5:** As a user, I visit the **Armory** to pick the equipment loadout for a quest — which skills, tools, and MCP servers the adventurer will carry.
- **US-6:** As a user, I dispatch a quest. By default the system **auto-matches** an adventurer; I can override before dispatch.
- **US-7:** As a user, I can **spin up new adventurers** from the Town Square (pick name + class), expanding my guild roster.

### Quest (the adventure)
- **US-8:** As a user, when a quest launches I am taken into Quest Mode — a 2D side-scroller scene where my adventurer walks left-to-right.
- **US-9:** As a user, I see monsters appear as the adventurer encounters obstacles. Each has a **D&D type** (Goblin / Imp / Wraith / etc.), a **generated or known name** ("Grognak the Lint Goblin"), and a **difficulty rating**.
- **US-10:** As a user, I watch combat play out in place — sprites animate, the combat log streams below.
- **US-11:** As a user, when the adventurer needs my input, I hear the bell, the screen freezes on the current frame, and I respond inline on a parchment-style modal.
- **US-12:** As a user, I can return to town any time (without ending the quest) — the adventurer continues, and the bell calls me back when needed.

### Learning loop
- **US-13:** As a user, after a quest, I see any **skill candidates** the factory has identified (patterns it noticed) and can confirm or dismiss them in the Library.
- **US-14:** As a user, I can browse the Library to see all unlocked skills, available tools, MCP servers, and the bestiary of named monsters slain.
- **US-15:** As a user, I can manually **forge a skill** from a recurring monster.
- **US-16:** As a user, I can **define a custom monster type** — pair a name + sprite + failure-pattern signature — so future quests recognize it.
- **US-17:** As a user, when a previously-faced monster (e.g., Grognak) reappears in a new quest, I see it as a *known* foe with its track record — not a fresh stranger.

### Failure & feedback
- **US-18:** As a user, when a quest fails, the adventurer returns to the **Hall of Returns** with a combat log, the obstacle that killed them, and a recommendation (re-post / retire / break into smaller quests / level up first).
- **US-19:** As a user, I leave feedback and choose to re-post (with new equipment / different adventurer / clarified ACs) or retire.
- **US-20:** As a user, a failed quest may **add a scar** to the adventurer's record — informing future auto-match decisions.

---

## 10. Data Model

```ts
type QuestStatus =
  | "drafted" | "posted" | "claimed" | "in_progress"
  | "combat" | "paused_input" | "user_blocked"
  | "completed" | "failed" | "returned_to_town" | "retired";

type AdventurerClass = "champion" | "ranger" | "scout" | "rogue" | "apprentice";

// Built-in monster type slugs (extensible by users)
type BuiltInMonsterType =
  | "goblin_linter"
  | "imp_typecheck"
  | "wraith_flaky_test"
  | "ogre_failing_test"
  | "hydra_ac_mismatch"
  | "mimic_silent_failure"
  | "wizard_env_or_dep"
  | "troll_build_fail"
  | "lich_repeated_failure"   // boss-tier
  | "dragon_epic_obstacle";   // final boss

interface Quest {
  id: string;
  parentEpicId?: string;        // if part of an epic
  title: string;
  description: string;
  acceptanceCriteria: string[];
  edgeCases: string[];          // gathered in the Tavern
  context: string;              // gathered in the Library
  status: QuestStatus;
  adventurerId?: string;        // assigned adventurer (auto-matched or user-picked)
  agentId?: string;             // ephemeral agent subprocess id (present while quest is active)
  equipment: Equipment;         // loadout for this quest
  specAudit: SpecAudit;         // result of preflight; what buildings to visit if gaps
  createdAt: string;
  updatedAt: string;
  acLockedAt?: string;          // set when status transitions to claimed
  attempts: QuestAttempt[];
  inputRequest?: InputRequest;
  userBlocker?: UserBlocker;
  failureSummary?: FailureSummary;
  userFeedback?: string[];
}

interface Epic {
  id: string;
  title: string;
  goal: string;
  storyIds: string[];           // ordered; dependencies expressed via order
  createdAt: string;
}

interface Adventurer {              // PERSISTENT identity
  id: string;
  name: string;
  class: AdventurerClass;
  modelId: string;                  // e.g. claude-opus-4-7
  stats: {
    questsWon: number;
    questsLost: number;
    monstersSlain: Record<string, number>; // keyed by MonsterType id
  };
  specializations: string[];        // emergent tags ("hydra-slayer")
  scars: ScarRecord[];              // notable past failures
  createdAt: string;
}

interface Agent {                   // EPHEMERAL subprocess (dies when quest ends)
  id: string;
  adventurerId: string;             // which adventurer is running it
  questId: string;
  startedAt: string;
  endedAt?: string;
  pid?: number;                     // subprocess PID
  exitCode?: number;
}

interface QuestAttempt {
  startedAt: string;
  endedAt?: string;
  agentId: string;                  // the agent that ran this attempt
  outcome: "completed" | "failed" | "paused";
  encounters: MonsterEncounter[];
  log: LogEntry[];
}

// MONSTERS — three layers

interface MonsterType {             // CATEGORY (built-in or user-defined)
  id: string;                       // e.g. "goblin_linter" or "user:eslint_unused_imports"
  name: string;
  spritePath: string;
  defaultDifficulty: 1 | 2 | 3 | 4 | 5;
  failureSignature: string;         // regex / pattern that classifies a failure to this type
  createdBy: "system" | "user";
}

interface Monster {                 // NAMED, PERSISTENT instance ("Grognak")
  id: string;
  typeId: string;                   // references MonsterType
  name: string;                     // user- or system-named
  scope: "project" | "guild";       // project = local slime; guild = cross-project nemesis
  projectId?: string;               // set when scope = project
  firstSeenAt: string;
  lastSeenAt: string;
  encounters: number;
  defeats: number;
  escapes: number;
  calibratedDifficulty: 1 | 2 | 3 | 4 | 5;
  notes?: string;                   // user-added lore
}

interface MonsterEncounter {        // SINGLE encounter in a quest
  id: string;
  monsterId: string;                // references Monster (named instance)
  questId: string;
  appearedAt: string;
  combatLog: string[];
  outcome: "defeated" | "fled" | "fatal";
  loot?: { skillCandidateId?: string; xp?: number };
}

// EQUIPMENT MODEL

interface Equipment {               // per-quest loadout
  skillIds: string[];
  toolIds: string[];
  mcpServerIds: string[];
}

interface Skill {                   // GLOBAL, unlocked once
  id: string;
  name: string;                     // "Linter's Bane"
  monsterTypeIds: string[];         // what it counters
  status: "candidate" | "unlocked";
  createdBy: "user" | "auto_detected";
  createdAt: string;
  hitCount: number;
  implementation: string;           // script ref / strategy descriptor
}

interface Tool {
  id: string;
  name: string;                     // "gh", "playwright", "pnpm"
  description: string;
  invocation: string;               // how the agent calls it
}

interface MCPServer {
  id: string;
  name: string;                     // "filesystem", "github"
  config: Record<string, unknown>;
}

// SPEC AUDIT & TOWN ROUTING

interface SpecAudit {
  runAt: string;
  gaps: SpecGap[];                  // each gap routes the user to a building
  bypassed?: boolean;               // user dispatched anyway
}

interface SpecGap {
  building: "war_room" | "oracle" | "library" | "tavern" | "armory" | "guild_hall";
  reason: string;                   // human-readable, e.g. "Acceptance criteria are vague"
  severity: "warn" | "block";
}

interface ScarRecord {
  questId: string;
  failureSummary: string;
  monsterIdAtFatal: string;
  occurredAt: string;
}

interface InputRequest {            // agent-initiated block (PAUSED_INPUT)
  question: string;
  context?: string;
  awaitingSince: string;
  adventureFraming?: string;        // narrative-framed version of the question
}

interface UserBlocker {             // user-initiated block (USER_BLOCKED)
  rawDescription: string;           // what the user wrote ("waiting on design review")
  adventureFraming?: string;        // narrative-framed version generated by the system
  markedAt: string;
  unblockedAt?: string;
}

interface FailureSummary {
  fatalEncounterId: string;
  retries: number;
  recommendation: "repost_with_clarification" | "retire" | "break_into_smaller" | "level_up_first";
  notes: string;
}
```

Persist as SQLite (server-side). Quests + attempts + encounters are append-only; the combat log is the source of truth for learning.

---

## 11. UI / UX

- **2D side-scroller, fixed camera, scene-based.** Both Town and Quest are rendered this way. No follow-cam — each scene is a stage you see all at once. Touchstones: `Darkest Dungeon`, classic JRPG battle screens, `Castlevania`, `Shovel Knight`.
- **Medieval D&D pixel art.** Stone, timber, parchment, torchlight, banners, dungeon tiles. **All assets sourced from free/openly-licensed packs** — no in-house art needed.
  - Primary asset sources: **Kenney.nl** (CC0 — best for general medieval/RPG), **0x72 Dungeon Tileset II** on itch.io (CC-BY — dungeons), **OpenGameArt.org** (mixed licenses; filter for CC0/CC-BY).
  - License compliance: every asset's license is recorded in `assets/CREDITS.md` at install time.
- **Town layout.** Side-scrolling village. Town Square is the central scene (with Quest Board mounted on a wall, plus a recruiting banner for new adventurers). Other buildings (War Room, Oracle, Library, Tavern, Armory, Guild Hall, Hall of Returns) are arranged left/right; the user walks or clicks to enter them.
- **Quest layout.** Sequence of scenes (e.g., forest path → cave → dungeon corridor → boss room). The adventurer walks left-to-right across each scene; when they reach the edge, scene transitions. Monsters appear and combat happens in place.
- **Party Map** — peek-overlay (banner-on-parchment style) listing every active adventurer + which scene they're in; click to jump to that quest. **Visible from both Town and Quest** — the user can be in town planning while glancing at active quests.
- **Combat surface** — adventurer faces the monster on-screen; HP bar metaphor (= retry budget); combat log streams in a parchment scroll beneath. Difficulty rating ★1–★5 visible on the monster.
- **PAUSED_INPUT freeze** — quest scene animation pauses, a parchment-style modal shows the question, bell rings; all other app animations also pause to enforce attention.
- **Library / Skill Tree / Bestiary** — D&D-style spellbook layout; unlocked skills as illustrated tomes/scrolls; bestiary tab for monsters slain, with sprite + difficulty + encounter history per named monster.
- **Accessibility** — every state has non-audio cues, keyboard-navigable, screen-reader summaries; reduced-motion mode swaps animation for status-text views.

---

## 12. Tech Stack

- **Frontend:** TypeScript + React + Vite
- **Game rendering:** Phaser 3 (purpose-built 2D engine, sprite/scene system) for both Town and Quest views — React handles HUD/overlays, Phaser handles the side-scroller canvas
- **Audio:** **Web Audio API + bundled CC0 chiptune tracks** (OpenGameArt sources — Juhani Junkala / HorrorPen primary); abstract `AudioBackend` interface so the impl can swap (procedural via Tone.js later). No third-party iframe dependency.
- **Art assets:** Free/CC0 pixel art (Kenney.nl primary, 0x72 Dungeon Tileset II for dungeons). Recorded in `assets/CREDITS.md`.
- **State:** Zustand; server state via TanStack Query; realtime via WebSocket
- **Backend:** Node + Express
- **DB:** SQLite via better-sqlite3 (local-first; no cloud sync in v1)
- **Agent integration:** abstract `AgentAdapter` interface; first impl wraps Claude Code as a subprocess
- **Tests:** Vitest + Playwright (HUD/UI); Phaser scenes get smoke tests via headless canvas

---

## 13. Security & Privacy

- Local-first by default. SQLite on the user's machine. No cloud sync in v1.
- API keys (Anthropic, OpenAI) stored via OS keychain.
- Agent subprocesses inherit a restricted env.
- Quest descriptions can contain sensitive prompts; never logged to telemetry.
- No third-party analytics in v1.

---

## 14. Non-Goals

- Not a task management app (no Jira/Linear features beyond what the metaphor supports).
- Not multi-user / shared dashboard in v1. Single-user, single-machine.
- Not a replacement for the dark factory. Standalone product.
- Not a chat interface. The bell + paused-quest flow is the only inline conversation surface.
- Not a generic gamification layer. The game is the product, not a skin.

---

## 15. Phase Overview

Rough phase plan (factory will refine into per-phase specs):

- **Phase 1 — Town skeleton (HUD only):** Quest + Epic + Adventurer CRUD, SQLite store, Express API, basic Town view in React. Adventurer spawn from Town Square. No Phaser scene yet.
- **Phase 2 — Phaser side-scroller + Town scenes:** Phaser integration; Town Square + War Room + Oracle + Library + Tavern + Armory + Guild Hall + Hall of Returns rendered as side-scrolling scenes; pixel art assets installed (Kenney + 0x72); user can walk between buildings.
- **Phase 3 — Spec audit + town routing:** Haiku preflight runs on dispatch; gaps route the user to specific buildings ("vague ACs → Oracle"); equipment loadout selectable in the Armory.
- **Phase 4 — Adventurer adapter (Claude Code):** First agent adapter spawns a subprocess at quest claim; agent inherits the quest's equipment loadout; streams progress events; AC locks at claim time. Auto-match default ON.
- **Phase 5 — Quest scenes:** First Quest Mode scenes (forest → cave → dungeon); adventurer sprite walks left-to-right; scene transitions; Party Map overlay.
- **Phase 6 — Monsters (bestiary v1):** Detect lint/type/test/AC failures as `MonsterEncounter` records; built-in D&D monster types with sprites; combat surface; difficulty ratings; named monster instances persist across quests.
- **Phase 7 — PAUSED_INPUT flow:** Bell, screen-freeze, parchment modal, inline response, agent resumption.
- **Phase 8 — Audio:** `AudioBackend` interface; bundle CC0 chiptune tracks (Juhani Junkala et al.) for Town/Road/Combat/Boss/Victory/Failure; bell sound; mute + silent-mode toggles.
- **Phase 9 — Returned quests + feedback + scars:** Failure summaries in Hall of Returns; re-post / retire / break-into-smaller; failed quests can add scars to adventurer records.
- **Phase 10 — Learning loop (skills + custom monsters):** Auto-detected skill candidates; Library forge flow; user-defined monster types with custom failure-pattern signatures; bestiary view.
- **Phase 11 — Capstone:** End-to-end demo — user creates an epic, breaks it into 3 stories, system auto-matches a Champion + two Scouts, watches monsters (some known, some new) appear and get slain (some via skills, some via combat), one quest pauses for input, one fails and adds a scar then gets re-posted with new equipment, all complete.

---

## Decisions Log

All major open questions resolved as of 2026-05-26:

- ✅ **Skills global, no class restrictions** — any adventurer can wield any tool/skill the guild owns
- ✅ **Adventurers global across projects** — guild is shared; stats and scars accumulate everywhere
- ✅ **Monster scope:** common monsters (slimes/goblins) live per-project; nemeses (named) live at guild scope and follow the user across projects
- ✅ **No progression gates, no costs** — unlimited adventurers; only hardware is the limit
- ✅ **Auto-match ON by default**, with override
- ✅ **User-extensible bestiary** — define new MonsterTypes with sprite + failure signature
- ✅ **Audio:** own implementation. No iframe dependency on Wario Synth. CC0 chiptune tracks via Web Audio API; abstract `AudioBackend` interface
- ✅ **Blockers** — both agent-initiated (`PAUSED_INPUT`) and user-initiated (`USER_BLOCKED`) are first-class quest states, surfaced as in-world obstacles with narrative framing
- ✅ **Pixel art** from free sources (Kenney.nl, 0x72 Dungeon Tileset II, OpenGameArt). No in-house art.

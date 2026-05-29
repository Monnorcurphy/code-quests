# Phase 11 Walkthrough — End-to-End Showcase Demo

Phase 11 is the capstone of Code Quests: a fully-scripted demo that exercises every feature built across all ten prior phases in a single coherent narrative. Three adventurers tackle three parallel quests inside the "Modernize the Auth System" epic — encountering monsters, hitting a user-input blocker, failing and re-posting, and ultimately succeeding. The learning loop fires when a new skill candidate surfaces at the end.

---

## Setup

```bash
# Install dependencies and start dev servers in demo mode
CODE_QUESTS_ENV=demo pnpm dev
```

Then click **Start Showcase Demo** in the Town Square panel. This calls `POST /api/showcase/reset`, seeds the DB with the showcase epic and adventurers, and navigates you to Step 2.

---

## Step 1 — Town Square: Launch the app

![step-01-town-square](../../assets/screenshots/phase-11/step-01-town-square.png)

Open `http://localhost:5173`. The browser lands on the **Town Square** Phaser scene — a 2 400 px-wide pixel-art street with seven building doors. The Party Map chip (top-right corner) shows "0 active". The Hall of Returns badge is absent (no returned quests yet). A **Start Showcase Demo** button appears in the Town Square overlay panel.

Click **Start Showcase Demo** to seed the DB and proceed.

---

## Step 2 — War Room: The auth epic

![step-02-war-room-epic](../../assets/screenshots/phase-11/step-02-war-room-epic.png)

The app navigates to `/town/war-room`. The Planning Table shows the **"Modernize the Auth System"** epic with three stories on the Quest Board:

| Quest | Equipment |
|---|---|
| Migrate to JWT | `type_whisperer`, `linters_bane` |
| Update login form copy | `linters_bane` |
| Add password strength meter | `wraith_banisher` |

All three quests show **✓ Ready** — the Spec Audit has no gaps.

---

## Step 3 — Armory: Auto-match preview

![step-03-armory-auto-match](../../assets/screenshots/phase-11/step-03-armory-auto-match.png)

Walk to the **Armory** door and press Enter (or click "Armory" in the hidden nav). The Armory auto-match preview runs in parallel across all three quests:

| Quest | Auto-matched adventurer | Score | Reason |
|---|---|---|---|
| Migrate to JWT | **Brielle the Bold** | 92 | `type_safety` specialization + 8 prior wins (4 vs `imp_typecheck`) |
| Update login form copy | **Tess the Tenacious** | 78 | `copy_editing` specialization + `linters_bane` skill equipped |
| Add password strength meter | **Rook the Relentless** | 74 | `wraith_banisher` skill aligns with flaky-test risk |

Each row shows the suggested adventurer pre-selected; the user can override before dispatching.

---

## Step 4 — Party Map: All 3 quests in motion

![step-04-party-map-parallel](../../assets/screenshots/phase-11/step-04-party-map-parallel.png)

Click **Dispatch** on each quest (or use the bulk-dispatch button if present). All three agents start simultaneously. The **Party Map** chip expands to show three rows:

```
⚔ Migrate to JWT          — Brielle — dungeon
⚔ Update login form copy  — Tess    — cave
⚔ Add password meter      — Rook    — forest
```

Click any row to jump to `/quest/:questId` for that adventurer's scene.

---

## Step 5 — Tess vs. Grognak the Lint Goblin

![step-05-tess-grognak-goblin](../../assets/screenshots/phase-11/step-05-tess-grognak-goblin.png)

Navigate to Tess's quest (`/quest/quest-showcase-copy`). In the cave scene, a **Goblin** sprite rises from the right side of the canvas:

> **Grognak the Lint Goblin**  ★★☆☆☆

The encounter panel (top-right corner) shows the monster sprite, HP bar, and the skill `linters_bane` firing. Because Tess has defeated this specific named monster before, the combat log reads:

> 🗡 Linter's Bane activated — known adversary detected (familiar × 2)

The goblin HP drops to zero within two log lines. "Victory!" stinger plays (or the visual stinger toast fires in silent mode).

---

## Step 6 — Rook vs. an Imp (new encounter)

![step-06-rook-imp-encounter](../../assets/screenshots/phase-11/step-06-rook-imp-encounter.png)

Navigate to Rook's quest (`/quest/quest-showcase-meter`). In the forest scene, a fresh **Imp of Type Errors** appears:

> **Imp of Type Errors**  ★★☆☆☆

This Imp is a first encounter — no "familiar" banner. Rook's `wraith_banisher` skill engages:

> 🗡 Wraith Banisher — dispelling type instability…

The Imp is defeated after three combat log entries. The scene progresses from forest to cave.

---

## Step 7 — Brielle hits a `PAUSED_INPUT` blocker

![step-07-brielle-paused-input](../../assets/screenshots/phase-11/step-07-brielle-paused-input.png)

Navigate to Brielle's quest (`/quest/quest-showcase-jwt`). Mid-dungeon, the **Pause Bell** fires:

- The screen edge flashes amber.
- A modal overlays the canvas with focus trapped inside:

> **Brielle needs your input**
>
> Which JWT library should I use — **jose** or **jsonwebtoken**?  
> The ADR mentions both but does not specify.
>
> [ Your reply… ]  [ Send ]

The quest status badge changes from "Active" to **"Awaiting Input"**. All CSS animations on the quest scene pause (`data-quest-paused="true"` on `<body>`).

Type `jose` in the textarea and click **Send**. Brielle resumes.

---

## Step 8 — Brielle's quest fails: Lich of Repeated Failures

![step-08-hall-of-returns-returned](../../assets/screenshots/phase-11/step-08-hall-of-returns-returned.png)

Back in the dungeon, three `imp_typecheck` encounters accumulate. The **Lich aggregator** fires:

> ☠ Lich of Repeated Failures has risen — 3 type errors in one quest

Brielle cannot defeat the Lich without `type_whisperer` equipped. The quest transitions to `failed` → `returned_to_town`. The Hall of Returns badge appears in Town Square:

> **📜 1 quest returned**

The app navigates to `/town/hall-of-returns`. The **Returned** tab is active, showing:

| Quest | Adventurer | Recommendation |
|---|---|---|
| Migrate to JWT | Brielle the Bold | Re-post with new equipment |

---

## Step 9 — Failure summary: re-post with `type_whisperer`

![step-09-repost-panel](../../assets/screenshots/phase-11/step-09-repost-panel.png)

Click the **Migrate to JWT** row. The post-mortem panel loads:

- **Combat log replay** — three Imp encounters, then the Lich.
- **Failure summary card:**

> Repeated TypeScript type errors escalated to a Lich. Equip `type_whisperer` on the next attempt.  
> *Recommendation: Re-post with new equipment* ✦ Recommended

Click **Re-post** → the re-post dialog opens with original ACs pre-filled. Under Equipment, `type_whisperer` is already checked (pre-filled from the recommendation). Click **Re-post Quest** → a toast reads:

> New quest posted: "Migrate to JWT (v2)"

---

## Step 10 — Brielle's second attempt: victory

![step-10-brielle-victory](../../assets/screenshots/phase-11/step-10-brielle-victory.png)

Dispatch the re-posted quest. Navigate to `/quest/quest-showcase-jwt-v2`. Brielle re-enters the dungeon with `type_whisperer` equipped. Each Imp is defeated in one combat log entry:

> ⚡ Type Whisperer — type resolved on first attempt

The Lich never rises (fewer than 3 encounters). The quest status badge transitions to **"Complete"** and the victory fanfare plays. The scene displays a completion banner:

> 🎉 Quest complete — Migrate to JWT (v2)

---

## Step 11 — Library: `ac_cartographer` skill candidate

![step-11-library-skill-candidate](../../assets/screenshots/phase-11/step-11-library-skill-candidate.png)

A gold ribbon appears in Town Square:

> **Library has news — 1 skill candidate ready** [Go to Library]

Click **Go to Library**. The Library modal opens on the **Skills** tab with one candidate card:

```
AC Cartographer
Detected after 2 Hydra encounters • Hit count: 2
[Confirm Skill]  [Dismiss]
```

The candidate was surfaced because the showcase has accumulated AC-mismatch encounters across previous phases. Click **Confirm Skill** → rename to "AC Cartographer" → submit → success toast. The skill is now available in the Armory for every future quest.

---

## Step 12 — Hall of Returns: all 3 quests complete

![step-12-hall-of-returns](../../assets/screenshots/phase-11/step-12-hall-of-returns.png)

Walk to the Hall of Returns. Switch to the **Completed** tab. All three quests appear:

| Quest | Adventurer | Outcome |
|---|---|---|
| Update login form copy | Tess the Tenacious | ✓ Victorious |
| Add password strength meter | Rook the Relentless | ✓ Victorious |
| Migrate to JWT (v2) | Brielle the Bold | ✓ Victorious |

The epic **"Modernize the Auth System"** is complete. The Armory now lists `ac_cartographer` as an unlocked skill for all future quests. The guild has grown stronger.

---

## Reproducing the screenshots

```bash
# Requires dev servers running
CODE_QUESTS_ENV=demo pnpm dev &

# Capture all 12 screenshots
pnpm test:e2e --grep "Showcase walkthrough"
```

Screenshots are written to `assets/screenshots/phase-11/`.

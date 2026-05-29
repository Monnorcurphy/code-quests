# Phase 10 Walkthrough — The Self-Improvement Learning Loop

Phase 10 completes Code Quests' core promise: the more your adventurer fights, the smarter the system gets. After a familiar monster is defeated three times, the app proposes a "skill" — a remembered strategy the adventurer can carry into every future quest. This document is the verified human walkthrough for all Phase 10 features.

---

## Setup

```bash
# From the repo root
pnpm install

# Start dev servers (client + server)
pnpm dev

# Seed Phase 10 demo data
pnpm --filter=@code-quests/server tsx src/scripts/seed-dev.ts --phase-10-demo
```

The seed script creates a demo adventurer ("Aldric the Learned"), two completed quests, three victorious encounters against a Goblin (Linter) monster, and evaluates the skill-candidate threshold — so the learning loop is ready to demo on first launch.

---

## Step 1 — Town Square: "Library has news" ribbon

Open `http://localhost:5173`. Walk to the Town Square banner (or press Enter at the banner) to open the Town Square modal.

At the top of the modal, a gold ribbon reads:

> **Library has news — 1 skill candidate ready**  [Go to Library]

This ribbon appears when:
- There is at least one skill with `status = 'candidate'`, OR
- The user has never opened the Library in this browser (tracked via `localStorage`)

The ribbon auto-dismisses once the Library has been opened and all candidates are resolved.

---

## Step 2 — Click the ribbon → Library opens on Skills tab

Click **Go to Library** in the ribbon. The Library modal opens and the **Skills** tab is automatically selected (instead of the default Bestiary tab).

One candidate card is visible:

```
Auto: Goblin (Linter)
Detected after 3 victories • Hit count: 3
[Confirm Skill]  [Dismiss]
```

The "Auto:" prefix is intentionally plain — it nudges the user to rename the skill at confirm time.

---

## Step 3 — Confirm the skill candidate

Click **Confirm Skill** on the candidate card. An inline form expands:

- **Name** (pre-filled: "Auto: Goblin (Linter)") — rename to something memorable, e.g. "Goblin Linter Slayer"
- **Implementation** — optional notes on how to fight this monster type

Submit the form. A green success toast appears:

> Skill confirmed!

The candidate card disappears from the Candidates section. The **Unlocked Skills** section now lists "Goblin Linter Slayer" (or your chosen name). The Skills tab dot indicator (pending candidates badge) disappears from the tab header.

---

## Step 4 — Town Square ribbon dismisses

Close the Library. Return to the Town Square. The "Library has news" ribbon is gone — you have opened the Library and resolved all pending candidates.

---

## Step 5 — Armory: "🔓 New skill available" chip

Walk to the Armory building (or open from the Town Square sidebar). Open the Loadout for any quest.

In the **Skills** column, a green chip appears next to the "Skills" heading:

> 🔓 New skill available

Click the chip. The panel scrolls to the first unequipped active skill, which is highlighted in green text. Check the checkbox next to it to equip the skill, then click **Save Loadout**. A success toast confirms the save.

The chip disappears once the new skill is equipped.

---

## Step 6 — Coin a new monster type

Return to the Library (Bestiary tab, which is the default). Click **+ Coin New Type**.

The "Coin New Monster Type" modal opens. Fill in:

- **Name**: Slug
- **Failure signature**: `eslint.*max-len`  (regex pattern that matches lint output for the max-len rule)
- **Sprite**: click any sprite in the picker (keyboard-navigable with arrow keys)
- **Difficulty**: leave at default (1)

Click **Create Type**. A success toast confirms:

> Monster type "Slug" created

Re-open the Bestiary. "Slug" doesn't appear in the monster list yet (it's never been encountered), but the type now exists in the system and will be used for automatic failure classification if a quest log matches the regex.

To verify "Slug" is available: open the **Forge Skill** modal (from any monster detail) — the monster type dropdown includes "Slug".

---

## Step 7 — Forge a skill manually from monster detail

In the Bestiary list, click **Grimtooth the Goblin** (or any listed monster). The monster detail panel opens, showing encounter history and difficulty calibration.

Click **⚒ Forge Skill**. The Forge Skill modal opens, pre-filled with the monster's type.

Fill in the form:
- **Name**: e.g. "Goblin Suppressor"
- **Monster type**: pre-selected as "Goblin (Linter)"
- **Implementation**: e.g. "Run eslint --fix before dispatching the quest"

Click **Forge Skill**. A success toast confirms. The new skill appears in the **Skills** tab under Unlocked Skills, immediately available for equipping in the Armory.

---

## Step 8 — Accessibility verification

Each of the four key Phase 10 surfaces passes `axe-core` with zero violations:

| Surface | Route |
|---|---|
| Library modal — Bestiary tab | `/town/library` |
| Library modal — Skills tab | `/town/library` → click Skills tab |
| Coin New Type modal | Library → Bestiary → click "+ Coin New Type" |
| Armory loadout | `/town/armory` |

To run the automated checks:

```bash
pnpm test:e2e --grep "Phase 10"
```

---

## What Phase 10 built

| Feature | Where to find it |
|---|---|
| Skill candidate auto-detection | Runs after every `victory` encounter; threshold: 3 victories of same type |
| Library → Skills tab | `/town/library` → Skills tab |
| Confirm / Dismiss / Retire skill flows | Library → Skills tab → candidate or active skill cards |
| Forge Skill manual flow | Library → Bestiary → monster detail → "⚒ Forge Skill" |
| Coin New Monster Type | Library → Bestiary → "+ Coin New Type" |
| Town Square ribbon | Town Square modal top — shows when candidates pending or Library never opened |
| Armory "new skill" chip | Armory → Loadout → Skills column heading |
| Phase 10 demo seed | `pnpm seed-dev.ts --phase-10-demo` |

---

## Known constraints (carry-forward to Phase 11)

- The `evaluateSkillCandidate` service does not filter by project — skills are global (per founding doc §5). Phase 11 may add `project_id` to encounters; the service's cross-project design is intentional.
- The `CANDIDATE_VICTORY_THRESHOLD = 3` constant in `skill-candidate-detection.ts` is stable and Phase 11 may reference it.
- The `--phase-10-demo` seed flag and the `"Auto: <typeName>"` candidate name format are stable API surfaces for Phase 11.

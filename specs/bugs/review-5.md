# BUG: Armory "New skill" chip can highlight/scroll to a candidate or retired skill instead of the new active skill

**Severity:** LOW
**File(s):** packages/client/src/features/armory/loadout-panel.tsx

## Problem

In `LoadoutPanel`, the chip-visibility check correctly filters to `active` skills:

```ts
const activeSkills = (skills as { … status?: string }[]).filter(
  (s) => s.status === 'active' || s.status === undefined,
);
const hasNewSkill = initialized && activeSkills.some((s) => !selectedSkillIds.includes(s.id));
```

But the scroll/highlight target in `LoadoutColumn` does NOT:

```ts
const firstUnequippedId = firstUnequippedRef
  ? items.find((i) => !selectedIds.includes(i.id))?.id
  : undefined;
```

`items` is the full skills array returned from `GET /skills`, which includes `candidate` and `retired` rows (see `packages/server/src/routes/skills.ts:49`, which returns all skills when no `status` filter is given, ordered by `created_at`). The very first unequipped item could therefore be a candidate (auto-generated and unconfirmed) or a retired skill that the user explicitly removed.

Practical impact: the chip says "🔓 New skill available" but clicking it can scroll the user to a `candidate` named e.g. "Auto: Goblin (Linter)" and apply the green highlight (`armory-item--new`) to it — directly contradicting the chip's promise that this is a newly *available* skill. The user may then check the candidate, which is not the intended interaction (candidates should be confirmed in the Library before being equippable).

This is a pre-existing concern that the loadout column renders candidates and retired skills as selectable checkboxes at all. Task indus did not introduce it, but the new chip behavior makes the gap user-visible and misleading.

## Expected

The chip's scroll/highlight target must point at an `active` skill — the same set the chip's visibility check uses. Ideally, the loadout panel should not present candidates or retired skills as selectable equipment at all; they should be filtered out before being passed into `LoadoutColumn`.

## Fix

Two options, in increasing order of cleanliness:

1. **Minimal fix in `LoadoutPanel`** — pass an already-filtered list to the Skills column:
   ```ts
   const equippableSkills = activeSkills; // already filtered to active
   …
   <LoadoutColumn
     heading="Skills"
     items={equippableSkills}
     …
   />
   ```
   This keeps the chip target consistent with the chip-visibility check and also stops the panel from offering candidates/retired skills as selectable.

2. **Belt-and-suspenders** — also pass the active-skill id set into `LoadoutColumn` and have it compute `firstUnequippedId` only from those ids. This protects future callers who might pass an unfiltered list.

After fixing, add a unit test that mounts the panel with a fixture containing one `candidate` skill first and one `active` skill second, both unequipped, and asserts the chip's click scrolls to the active skill — not the candidate.

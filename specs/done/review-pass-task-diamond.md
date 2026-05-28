# Review Pass — Task diamond

**Branch:** feature/diamond
**Parent:** feature/citrine
**Result:** FAIL — 1 HIGH bug filed.

## Checks Performed

- Read pre-computed diff (12 files, +801/-31)
- Read source for: `loadout-panel.tsx`, `use-equipment-mutation.ts`, `equipment-station.ts`, `armory-scene.ts`, `hud-overlay-manager.tsx`, `town-store.ts`, `api.ts`, `features.css`, `use-focus-trap.ts`, `loadout-panel.test.tsx`, `all-buildings.test.ts`, server `routes/quests.ts`, shared `equipment.ts` + `quest.ts`
- `pnpm -F @code-quests/client test` — 216/216 pass, 19/19 files
- `pnpm -F @code-quests/server test` — 101/101 pass, 8/8 files
- `pnpm -r typecheck` — clean across shared, server, client
- `pnpm -r lint` — clean across all workspaces
- grep for hardcoded secrets (`sk-`, `AKIA`, `api_key`, `password=`) — none
- Contrast scan (`text-{gray,neutral,slate,zinc}-{100..400}`) — only CSS variables used, no offending Tailwind classes
- Cross-boundary check: client `PatchQuestInput.equipment` ↔ server `PatchQuestSchema` (derived from `CreateQuestSchema.partial()` with `EquipmentSchema`) ↔ DB `equipment_json` TEXT column — shapes match, defaults match
- Capstone coverage: diamond is **not** the last task of Phase 3 (garnet is — see `specs/phase-03/sequence.md`), so no capstone gate applies

## Bugs Filed

1. `specs/bugs/review-1.md` — **HIGH** — LoadoutPanel does not move focus into the modal on open. All other modals in the codebase set initial focus; this one is the outlier and the acceptance criteria require keyboard accessibility.

## Informational Notes

These are not bugs — recording for future iteration:

1. **Redundant accessible name on checkboxes** (`loadout-panel.tsx:211-219`). The `<input>` has `aria-label={item.name}` AND is wrapped in a `<label>` whose visible text is `item.name`. The `aria-label` overrides the wrapping label as the accessible name and adds no value. Either drop `aria-label` (the wrapping label is sufficient and matches existing patterns elsewhere) or keep it for `screen.getByLabelText` test ergonomics. Test resolution currently relies on aria-label.

2. **`ApiError.field` is discarded in the save flow** (`loadout-panel.tsx:81`). The `patchJson` helper preserves the server's `field` in `ApiError`, but `handleSave` only reads `.message`. Equipment payload is a single nested object so per-field surfacing is low-value here, but the pattern could surface as friction later if the server starts validating individual array members.

3. **Double success-save timer leak** (`loadout-panel.tsx:78`). If the user clicks Save again while the previous 3-second success timeout is still pending, the previous timeout reference is overwritten without `clearTimeout`. The first timer still fires, but harmlessly sets `'idle'` again. Defensive cleanup `if (timerRef.current) clearTimeout(timerRef.current)` before `setTimeout(...)` would tighten this.

4. **Keyboard interactions are not unit-tested** (`__tests__/loadout-panel.test.tsx`). All 10 tests use `userEvent.click` — none assert Tab cycling, Space toggle, Enter on Save, or Escape closing. The acceptance criteria call these out explicitly. Native behaviors do work for Space/Enter/Tab once focus is inside the panel, but explicit `keyboard()` tests would lock the contract in.

5. **`quest.equipment?.skillIds ?? []`** defensive optional chaining (`loadout-panel.tsx:47-49`). `EquipmentSchema` defaults all three arrays, so `equipment` is always defined when reading a quest through `QuestSchema`. The optional chain is dead but harmless.

## Verdict

**FAIL** — 1 HIGH bug filed (`review-1.md`). Fixer agent must address the missing initial-focus effect before this task lands.

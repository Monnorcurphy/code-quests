# Review pass — task empress-of-ireland

## Summary of checks performed

- Read pre-computed diff (14 files; 1490 insertions, 244 deletions).
- Read new files in full: `bestiary.tsx`, `monster-detail.tsx`, `difficulty-stars.tsx`, `empty-state.tsx`, `bestiary.test.tsx`.
- Read modified `library.tsx`, `library-scene.ts`, `use-quest-stream.ts`, `test-setup.ts`, `package.json`.
- Verified shared Monster types in `packages/shared/src/monster.ts` match what the bestiary and detail components consume.
- Verified the new API surface (`api.monsters.list / listTypes / listEncounters`) is correctly defined in `packages/client/src/lib/api.ts`.
- Verified Tailwind/contrast-class safelist is not violated (the bestiary uses CSS custom properties only — `--color-text` `#2c2416`, `--color-text-secondary` `#5a4e3a`, `--color-stone` `#6b6b5e`, all on parchment `#f5f0e8`, all ≥ 4.5:1).
- Verified jest-axe is wired (`test-setup.ts` extends `expect` with `toHaveNoViolations`; vitest config has `globals: true`).
- Ran the full client test suite — 508 / 508 pass.
- Ran `pnpm -r typecheck` — clean.
- Ran `pnpm --filter @code-quests/client lint` — clean.
- Ran `pnpm --filter @code-quests/client build` — clean.
- Grep'd for `console.`, `sk-`, `AKIA`, `api_key`, `password=` in new files — none.
- Verified the spec's seven acceptance criteria:
  - Empty state ✓ (`empty-state.tsx` + test).
  - Difficulty stars + `aria-label="N of 5 stars"` ✓ (`difficulty-stars.tsx` + test).
  - Sort buttons real `<button>` with `aria-sort` ✓ (`SortHeader` in `bestiary.tsx`).
  - Loading skeleton + `aria-live="polite"` ✓.
  - Error state with retry button ✓ (`bestiary.tsx` + `monster-detail.tsx`).
  - Contrast — passes (variables above).
  - Axe-core zero violations — tests included for both empty + populated states.
  - `monster_appeared` invalidates `['monsters']` — wired in `use-quest-stream.ts:43-45`, but NOT covered by a test (see review-1.md).
- Verified cross-boundary types: `MonsterScope` (`project | guild`) matches Zod schema in shared; `MonsterEncounter.outcome` (`victory | defeat | escape`) matches `OUTCOME_LABELS` in `monster-detail.tsx`.

## Bugs filed

- `specs/bugs/review-1.md` — HIGH: missing test for `monster_appeared` query-cache invalidation.
- `specs/bugs/review-2.md` — HIGH: Library modal no longer auto-moves focus on mount (regression vs. previous Library + inconsistent with every other modal in the codebase + violates state-management rule).

## INFORMATIONAL notes (not bugs)

1. **Clickable `<tr>` row pattern in the bestiary table.** `MonsterRow` makes the entire row interactive via `tabIndex={0}` + `onClick` + `onKeyDown`. Axe-core does not flag this and the row carries an `aria-label="<name> — view details"`, so the screen-reader announcement is meaningful. WAI-ARIA Practices nonetheless recommend keeping interactive controls inside a cell (e.g., the Name cell as a `<button>`). Worth considering in a future polish pass.

2. **Tablist keyboard pattern uses Tab between tabs, not arrow keys.** The two tabs are real `<button role="tab">`s in tab order, so Tab + Enter works. The WAI-ARIA Tabs Pattern recommends arrow-key navigation with roving tabindex (only the active tab has `tabIndex=0`). Tab+Enter satisfies WCAG keyboard requirements but the arrow-key pattern would match user expectations on a tablist.

3. **`combat-log preview` shows only the event count.** The detail panel renders `"5 combat events"` instead of any actual log content. Justified by the `combatLog: z.array(z.unknown())` shape in the shared schema — no structure to preview against — but the spec wording suggested a richer preview. Revisit when the encounter event shape is firmed up.

4. **`MonsterDetail` issues a `useQuery` per encounter** to fetch the quest title (one per `EncounterItem`). TanStack will dedupe identical keys, but a monster with N encounters across N different quests means N round-trips. A combined `/quests?ids=…` lookup or pre-joined encounter payload would scale better; fine for v1 numbers.

5. **`<Bestiary />` keeps fetching while the Skills tab is active.** The tabpanel is hidden, not unmounted, so the bestiary stays mounted and its queries stay subscribed. This is intentional (preserves scroll/sort state across tab switches) and the query cost is low. Worth re-evaluating if Skills grows heavy queries of its own.

## Final verdict

FAIL — 2 HIGH bugs filed.

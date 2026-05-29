# Review Pass — Task aries

**Branch:** feature/aries
**Parent:** feature/aquarius

## Summary of checks performed

- Read pre-computed diff (`packages/server/src/services/auto-match.ts`, new `autoMatchWithReason`; new `GET /quests/:id/auto-match` route + tests; new `AutoMatchPreview` component + tests; war-room integration; dispatch-button + api.ts updated to thread `adventurerId`).
- Read `metrics/task-aries-context.md` (task spec) and confirmed scope: tie-break determinism, three deterministic showcase matches (Brielle→jwt, Tess→copy, Rook→meter), Armory preview with loading/empty/error states, override dropdown.
- Ran `pnpm --filter @code-quests/{shared,server,client} test` — 83 + 547 + 985 = 1615/1615 pass, including the new `auto-match-showcase.test.ts` (4), `auto-match-route.test.ts` (5), and `auto-match-preview.test.tsx` (8).
- Ran `pnpm -r typecheck` — clean across shared/server/client.
- Ran `pnpm --filter @code-quests/server lint` and `pnpm --filter @code-quests/client lint` — both clean.
- Grepped for hardcoded secrets (`sk-`, `AKIA`, `api_key`, `password=`) in the diff — none.
- Cross-boundary verification: server response `{adventurerId, adventurerName, adventurerClass, reason}` matches client Zod `z.object({adventurerId: z.string().nullable(), adventurerName: z.string().nullable(), adventurerClass: AdventurerClassSchema.nullable(), reason: z.string()})`. `AdventurerClassSchema` enum (`champion|ranger|scout|rogue|apprentice`) is the same value pulled from the DB row's `class` column. Dispatch body schema `z.object({adventurerId: z.string().min(1).optional(), bypass: z.boolean().optional()})` aligns with the client call `adventurerId ? { adventurerId } : {}` (null/undefined → empty body, server falls back to existing or auto-match).
- Determinism check: confirmed the new id-lexicographic tiebreak (`auto-match.ts:127`) sits after class/scar score, net wins, and createdAt, and the showcase test asserts results are identical on the reversed guild array (`auto-match-showcase.test.ts:155-166`).
- Accessibility: `<section aria-label="Auto-match suggestion">`, `aria-live="polite"`/`aria-busy="true"` on loading, `role="alert"` on error, `<label htmlFor="auto-match-adventurer-select">` linked to the `<select>`, `aria-describedby="auto-match-hint"` when a hint is present, and `useFocusTrap` already includes `select:not([disabled])` so the new control is reachable via Tab.
- UX feedback: loading / empty / error states all implemented; reason text is plain language ("Champion class + 8 wins, no relevant scars"); override dropdown defaults to "— Auto-select —" and calls `onSelectAdventurer(e.target.value || null)`.
- Capstone coverage: not the phase capstone — this task ships a new UI surface inside the existing War Room and a new GET route that is wired into `createQuestsRouter` and rendered by `war-room.tsx`. The feature is reachable from the Town Square → War Room flow.

## Findings filed

- `specs/bugs/review-1.md` — LOW — `auto-match-*` CSS classes have no styles in `features.css`. Error/loading/suggestion render as plain text, inconsistent with `dispatch-error`/`spec-audit-error`. Violates the "What just happened?" UX rule.
- `specs/bugs/review-2.md` — LOW — Race between the war-room adventurers list query and the auto-match query. While the list is still loading, `adventurers` is `[]` and `AutoMatchPreview` can briefly render "No adventurers in the guild — recruit one first." underneath the populated suggestion line. State is transient but contradictory.

## INFORMATIONAL notes

- `AutoMatchPreview` line 26 (`if (data?.adventurerId !== undefined && selectedAdventurerId === null)`): when `data.adventurerId === null` (empty guild) this still calls `onSelectAdventurer(null)`, which is a state-equal no-op. Worth keeping in mind if state propagation changes.
- The dispatch-button test was updated to assert the new third argument is `undefined` (`dispatch-button.test.tsx:235`). There are no tests covering `DispatchButton` being rendered with an actual `adventurerId` prop and forwarding it to `api.quests.dispatch` — the integration is only exercised at the route level. Adding a unit test that mounts `DispatchButton adventurerId="adv-x"` and asserts `mockDispatch.toHaveBeenLastCalledWith(quest.id, false, 'adv-x')` would be useful, but is not a hard rule violation.
- `progress.md` was rewritten in full for this task — fine per project convention since the previous content was archived to `metrics/progress-before-aries.md`.

## Final verdict

**FAIL — 2 LOW bugs filed.** Both are visual/UX quality issues, not functional or security defects. Tests, typecheck, and lint are clean.

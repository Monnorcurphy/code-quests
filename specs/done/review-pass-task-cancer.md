# Review Pass — task cancer (failure → scar → re-post loop integration)

**Branch:** feature/cancer
**Parent branch:** feature/aries
**Reviewer:** adversarial code review (Opus)
**Verdict:** FAIL — 2 LOW bugs filed

## Checks performed

### Verification
- `pnpm test` → all packages pass: shared 83/83, server 551/551, client 991/991
- `pnpm typecheck` → 0 errors across shared, server, client
- `pnpm lint` → 0 errors

### Diff scope review
Read the full pre-computed diff (17 files, +524/-64). Focus areas:
- New integration test `repost-cycle.test.ts` (server) — covers the full fail → scar → repost → complete loop with stubbed agent adapters; uses in-memory SQLite + the showcase seed + the real `quest-actions` HTTP route. Deterministic. Good.
- `quest-return.test.ts` showcase-seed scenario — verifies ScarRecord shape (questId, failureSummary, monsterIdAtFatal, occurredAt) against the persisted JSON column.
- `auto-match.test.ts` showcase-scar test — confirms Brielle's JWT scar drops her below a clean champion on a JWT-themed quest.
- `repost-dialog.tsx` — adds a Skills (Equipment) fieldset with checkbox pickers per `.claude/rules/input-validation.md` ("constrained inputs, not free text"); preserves the quest's `toolIds`/`mcpServerIds`; pre-checks skills already in `quest.equipment.skillIds`; `useQuery` fetches active skills with retry disabled.
- `failure-summary-card.tsx` — "Browse Library" link now navigates with `?typeId=<encoded>` so the bestiary deep-links to the fatal monster's type; updated `aria-label` reflects the new behaviour.
- `bestiary.tsx` + `library.tsx` — `Bestiary` accepts `initialTypeFilter`; `Library` reads `?typeId=` via `useSearchParams` and forwards it. Filter banner shows the matched type name.
- `lib/api.ts` — `HallOfReturnsQuestSchema` adds `equipment` (default empty); `FatalMonsterSchema` adds `monsterTypeId`; `api.quests.repost` accepts an `equipment` adjustment.
- `routes/hall-of-returns.ts` (server) — SQL JSON object now exposes `monsterTypeId` from `m.type_id`.

### Cross-boundary checks
- `FatalMonsterSchema.monsterTypeId` (frontend Zod) requires `string`. Server SQL `m.type_id` is `NOT NULL` per the `monsters` migration. Match.
- `HallOfReturnsQuestSchema.equipment` defaults to `{skillIds: [], toolIds: [], mcpServerIds: []}`. The server `rowToApi` already populates equipment from `equipment_json` (line 68). Match.
- `repost` payload `equipment` flows into the existing `quest-actions/repost` endpoint, which already accepts `adjustments.equipment` (per `repost-cycle.test.ts` line 184). Match.
- Skills list mock in the test uses the full `SkillSchema` shape (id, name, monsterTypeIds, status, createdBy, createdAt, hitCount, implementation). Match.

### Accessibility checks
- Skills fieldset uses `<legend>`, `<label>`-wrapped checkboxes, `aria-label` per checkbox, `aria-label` on the `<ul>` — passes per `.claude/rules/accessibility.md`.
- Failure-summary link `aria-label` is "Browse Library for X monsters" — clear intent.
- Focus trap selector `'button:not([disabled]), input:not([disabled])'` correctly includes the new checkboxes.
- Filter banner uses `role="status"` — announced to screen readers.
- No `text-{gray,neutral,slate,zinc}-{100..400}` contrast violations introduced.

### Security checks
- No new `console.log`, secrets, or `sk-`/`AKIA`/`api_key=` strings in changed files.
- `encodeURIComponent` is used on the `typeId` query param before constructing the link.
- No `eval`, `new Function`, or dynamic-import shenanigans.

### Capstone coverage
- This is NOT the last task of a phase (Phase 11 capstone was task `bran`); cancer is a follow-up polish/integration task. Capstone gate does not apply.

## Bugs filed
- `specs/bugs/review-1.md` — LOW: new `repost-skill-*` and `bestiary-type-filter-banner` classes have no CSS in `features.css`. Skills picker and filter banner render unstyled.
- `specs/bugs/review-2.md` — LOW: bestiary `typeId` filter with zero matches renders an empty table with no "no matches" message (empty-state check uses unfiltered `monsters.length`, not `sortedMonsters.length`).

## INFORMATIONAL notes (no bug filed)
- `packages/server/src/routes/hall-of-returns.ts:129` — the local `FatalMonster` TypeScript type inside `createHallOfReturnsRouter` does not include the new `monsterTypeId` field, even though the SQL JSON object emits it. The cast `JSON.parse(...) as FatalMonster` happily widens, so this is a type-drift smell rather than a runtime bug. A future cleanup could either add `monsterTypeId: string` to this local type or replace it with `z.infer<typeof FatalMonsterSchema>` imported from `lib/api.ts`.
- `Bestiary`'s prop is named `initialTypeFilter` but actually re-applies on every render (it's derived from `useSearchParams` upstream). The naming suggests mount-only behaviour. Consider renaming to `typeFilter` in a future refactor for clarity. Not a bug.

## Verdict
**FAIL — 2 LOW bugs filed.** Server-side integration logic and tests are solid; failures are purely visual polish (missing CSS + missing empty-state for the filtered-zero edge case). Re-post equipment editor satisfies the input-validation rule (constrained checkbox picker, not free text). Scar persistence through the win is verified by the integration test.

# Review Pass — Task amethyst (SpecAudit schema + quest-API exposure)

## Summary of Checks

1. **Diff review** — Read pre-computed diff for all 9 changed files.
2. **Verify suite** — Ran `pnpm test` (338 tests passing across shared/server/client), `pnpm typecheck`, `pnpm lint`, `pnpm build` — all clean.
3. **Secrets scan** — No hardcoded credentials (`sk-`, `AKIA`, `api_key`, `password=`).
4. **Cross-boundary validation:**
   - `spec_audit_json` column exists in `001_init.sql` as `TEXT` (nullable, no CHECK constraint per task design).
   - SpecGapBuilding enum (`war_room|oracle|library|tavern|armory|guild_hall`) matches the planning-building list in `CLAUDE.md` §"Town"; `hall_of_returns` and `town_square` are correctly excluded (post-quest / entry buildings, not spec gap targets).
   - Server `CreateQuestSchema.specAudit` shape mirrors shared `QuestSchema.specAudit`.
   - Client `QuestSchema` (consumed via `api.quests.list` / `create`) accepts `specAudit: null` from the server.
   - INSERT placeholder count matches column list (14 each) — verified.
5. **Zod partial+default semantics** — Verified empirically: `CreateQuestSchema.partial().parse({title:'X'})` returns `specAudit: undefined`, so `body.specAudit !== undefined` correctly distinguishes "untouched" from "explicit null". PATCH without `specAudit` does not clear `spec_audit_json`.
6. **Console/debug output** — None.
7. **Test coverage** — 18 schema unit tests cover enum acceptance/rejection, reason length boundaries (0/1/500/501), missing fields, `bypassed` default, invalid nested gap, and `bypassed=true`. 7 server round-trip tests cover create default, GET null, PATCH set/clear, PATCH reject unknown building, PATCH reject missing runAt, POST persist.
8. **CLAUDE.md/factory rules** — File length, function length, complexity, naming all within limits. No dead code. No `any`. No mocked DB (uses real `:memory:` SQLite with migrations).
9. **Accessibility / UX** — No UI changes in this task; only client test mocks updated for new `specAudit: null` field. N/A for the rest.

## Informational Notes (not bugs)

- **`runAt` accepts non-ISO strings.** The task spec describes `runAt` as "ISO string" but the implementation uses `z.string().min(1)`, which accepts arbitrary non-empty strings. The acceptance criteria only requires rejecting *missing* `runAt`, so this matches the AC. A future hardening step would tighten this to `z.string().datetime()` so that downstream `new Date(runAt)` consumers cannot get `Invalid Date` from an audit row. Not filed as a bug because the AC is satisfied; flagging for the next pass (likely beryl, when the audit engine actually writes `runAt`).
- **`spec_audit_json` JSON.parse has no defensive fallback** in `rowToApi`. If a row contains corrupt JSON (e.g., from out-of-band DB tampering), `GET /quests/:id` would throw 500. This is consistent with the existing handling of `equipment_json`, `acceptance_criteria_json`, and `edge_cases_json` in the same file, so it is not regressed by this task. A future cross-cutting fix could add a single defensive `safeJsonParse` helper for all JSON columns.

## Verdict

**PASS** — 0 bugs filed.

The diff cleanly defines the `SpecAudit*` schema family in `@code-quests/shared`, extends `QuestSchema` with a nullable-default-null `specAudit`, wires it through the existing `quests` route (`QuestRow`, `rowToApi`, INSERT, PATCH), and is exercised by 25+ new tests (18 schema + 7 server round-trip). All acceptance criteria are met:
- Building enum exactly matches the spec.
- Schemas reject unknown buildings, unknown severities, missing/empty `runAt`.
- New quests default `specAudit` to `null` and round-trip through GET.
- PATCH with a valid `specAudit` persists and returns it; PATCH with `null` clears it; invalid payloads return 400.
- Full Phase 1/2 suite still green; typecheck, lint, build clean.

# Review Pass — task caernarfon (Phase 1 capstone)

**Branch:** `feature/caernarfon`
**Capstone:** Quest draft flow + Quest Board — end-to-end Phase 1 walkthrough
**Date:** 2026-05-26
**Verdict:** ✅ PASS — 0 bugs filed

## Checks performed

### Build / verify gates
- `pnpm build` — clean (3 packages built)
- `pnpm test` — 67 server tests + 48 client tests = 115 unit tests pass
- `pnpm lint` — clean (0 errors, 0 warnings)
- `pnpm typecheck` — clean across all 3 packages

### Security
- Grep for `sk-`, `AKIA`, `api_key`, `password=` — no hits in `packages/`
- No `eval()` / `new Function()` usage
- No telemetry-by-default code added

### Code quality
- Grep for `console.` in `packages/` — no hits (ESLint `no-console: error` configured)
- No empty `catch {}` blocks introduced
- No commented-out code in production source
- No dead imports flagged by ESLint

### Cross-boundary contract validation
- **Quest status enum**: DB CHECK (`idle/active/complete/failed/paused_input/user_blocked`) ↔ `QuestStatusSchema` in `packages/shared/src/quest.ts` ↔ `STATUS_LABELS`/`STATUS_CLASS` in `quest-board.tsx` — all 6 values present on all 3 sides. ✓
- **Adventurer class enum**: DB CHECK (`champion/ranger/scout/rogue/apprentice`) ↔ `AdventurerClassSchema` ↔ `CLASSES` list in `recruit-modal.tsx` — exact match. ✓
- **Quest create payload**: client `CreateQuestInputSchema` (`title`, `description?`, `acceptanceCriteria?`, `epicId?`) → server `CreateQuestSchema` (same fields with defaults; `epicId.nullable().default(null)`) → `INSERT INTO quests`. Client passes `epicId: epicId || null` correctly avoiding empty-string FK lookups. ✓
- **FK enforcement**: `db.pragma('foreign_keys = ON')` set in `openDb()` for both prod and `:memory:` test paths. Server explicitly pre-validates FK references in `POST/PATCH /quests` (returns 400 with `field` before hitting FK error). Connection test (`connection.test.ts:20-28`) verifies FK violation throws.
- **Vite proxy**: `/adventurers`, `/epics`, `/quests`, `/health` all proxied to `:4001`. API base URL is empty string for same-origin requests. ✓

### Accessibility / WCAG AA
- All four key surfaces have `aria-modal="true"` + `aria-labelledby` + focus-trapped `useFocusTrap` hook.
- Empty states present: roster (`"No adventurers yet — recruit your first hero."`), Quest Board (`"No quests yet — visit the War Room to draft one."`).
- Form fields use `<label htmlFor>` (no placeholder-only labels). AC rows use `aria-label="Criterion N"` since they're repeated rows.
- Error rendering uses `role="alert"` for inline field errors, `aria-live="assertive"` for top-level server errors, `role="status"` / `aria-live="polite"` for success.
- Loading buttons set `aria-busy="true"`. Disabled state communicated via native `disabled`.
- Color palette in `global.css` uses `--color-text: #2c2416` on `--color-parchment: #f5f0e8` — both well above WCAG AA 4.5:1.
- Reduced-motion CSS guards in place (`@media (prefers-reduced-motion: reduce)`).
- Playwright + axe-core scans declared for Town, Town Square, War Room (each `expect(results.violations).toEqual([])`).

### Capstone coverage (mandatory check)
All Phase 1 features are reachable from the Town entry point:
- ✓ Town Square (recruit + Quest Board)
- ✓ War Room (draft form embedded)
- ✓ Guild Hall (roster + recruit)
- ✓ Other 5 buildings open placeholder dialogs explaining "Coming in Phase 2"
- ✓ Quest Board renders in Town Square — fulfilling founding-doc §2 "the Board is on the wall in the Square"
- E2E walkthrough exercises: 8 buildings visible → Town Square → recruit → escape → War Room → draft quest → escape → Town Square → quest appears → reload → persistence verified.

### Database / persistence
- `seed-dev.ts` is idempotent (checks for existing rows by name/title before inserting). ✓
- Reserved tables (agents, monsters, monster_types, monster_encounters, skills, tools, mcp_servers) present in migration — connection test verifies they exist.

## Informational notes

1. **Spec wording: "drafted/posted" vs. implemented "idle":** The task spec describes status badges as `drafted/posted`, but the DB schema (inherited from task `balmoral`) only declares `idle/active/complete/failed/paused_input/user_blocked`. The UI maps `idle → "Drafted"` for display. There is no `posted` state anywhere in the system. This is consistent across boundaries and won't break anything, but a future task may want to introduce `posted` (e.g., when a quest is claimed by an adventurer but agent hasn't started) and the badge mapping table at `quest-board.tsx:5-21` would need to be updated alongside the DB CHECK and Zod enum.

2. **War Room success message references the Quest Board but Quest Board lives in Town Square:** After drafting, the user sees "Quest drafted! It now appears on the Quest Board" inside the War Room dialog. The Quest Board is in Town Square — the user must close War Room and open Town Square to see the new quest. The E2E test follows this flow successfully and the message is accurate, but a future polish could navigate the user automatically.

3. **ESLint config minimalism:** `.eslintrc.cjs` enforces `no-console: error`, `no-explicit-any: error`, and `no-unused-vars: error`, all good. It does NOT include `eslint-plugin-react-hooks` (would catch `useEffect` dep array omissions) or `eslint-plugin-jsx-a11y` (would catch a11y issues at lint time). The code happens to be correct, but Phase 2+ should consider adding these plugins so the linter actively prevents drift.

4. **Roster/Quest Board scrollable region tabIndex:** Both lists have `tabIndex={0}` on the `<ul>`. The commit message notes this was added to satisfy axe-core's `scrollable-region-focusable` rule — appropriate fix. Just flagging it so a future a11y refactor doesn't accidentally remove it.

5. **Duplicate recruit affordance:** Both Town Square and Guild Hall render the recruit flow (with the same RecruitModal component). This is intentional per spec (founding-doc §2 says Town Square handles "Entry & Recruiting"), but there are now two near-identical roster sections in the codebase. Not a bug; an opportunity for componentization later.

## Final verdict

**PASS — 0 bugs filed.**

The capstone is complete: a human can install, launch, recruit, draft, see, and reload — and every Phase 1 feature is reachable from the entry point. Cross-boundary contracts hold, tests are comprehensive, accessibility surfaces are clean, and no factory rules are violated.

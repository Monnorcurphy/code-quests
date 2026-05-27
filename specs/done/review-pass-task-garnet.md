# Review Pass — Task garnet

**Verdict:** FAIL — 4 bugs filed (2 HIGH, 2 LOW)

## Scope

Phase 3 capstone — wires the Oracle / Tavern / Library building panels into the town routing flow, adds an "Active Quest" badge to Town Square, seeds a quest with intentional gaps, and adds Playwright E2E coverage of the full draft → audit → fix → dispatch → reload journey.

## Checks performed

- Read full diff: 20 changed files, +1848/−68
- Read each new file once: `features/oracle.tsx`, `features/tavern.tsx`, `features/library.tsx`, `features/town-square.tsx`, `components/hud-overlay-manager.tsx`, `stores/town-store.ts`, `lib/use-focus-trap.ts`, `lib/api.ts`, `server/routes/quests.ts`, `server/scripts/seed-dev.ts`, `tests/e2e/phase-3-capstone.spec.ts`, `__tests__/{library,oracle,tavern}.test.tsx`, `game/scenes/__tests__/all-buildings.test.ts`, `game/scenes/{oracle,library,tavern}-scene.ts`, `styles/features.css`
- Verified shared `QuestSchema` and the server `PatchQuestSchema` against client validation
- `pnpm typecheck` — green
- `pnpm lint` — green, zero warnings
- `pnpm -r test --run` — 267 tests pass (24 files)
- Grepped for `console.log`/`console.debug` in new feature files — clean
- Grepped for banned Tailwind contrast classes (`text-{gray,neutral,slate,zinc}-{100..400}`, `border-gray-{100..300}`) — none present
- Grepped for hardcoded secrets (`sk-`, `AKIA`, `api_key`, `password=`) — none present
- Capstone reachability per `phase-capstone.md`:
  - War Room: reachable via the Planning Table door in town-square scene ✅
  - Oracle / Tavern / Library / Armory: reachable both via the building doors in town-square and via the audit chips in the War Room ✅
  - Active Quest badge in Town Square links back to the War Room ✅
  - Seed quest "Improve search result ranking" has intentional gaps that exercise the chip → building → fix flow ✅
- Audited new modals for `role="dialog"` / `aria-modal="true"` / `aria-labelledby`, semantic `<fieldset>`/`<legend>`, `aria-live` save banners, `role="alert"` errors, visible focus rings — all present.
- Verified cross-boundary contract: `activeModal` enum was extended in `town-store.ts` to include `'oracle' | 'library' | 'tavern'` and matches the routes in `hud-overlay-manager.tsx`. Building scene keys match the `SpecGapBuilding` map in the store. No mismatches.

## Bugs filed

| # | Severity | Title |
|---|----------|-------|
| 1 | HIGH | Phase 3 capstone E2E test "active quest badge" uses banned conditional assertion |
| 2 | HIGH | Dispatch E2E flow uses conditional assertions and `waitForTimeout` |
| 3 | LOW  | Focus does not move into Oracle/Tavern/Library after async quest load |
| 4 | LOW  | Server PATCH validation does not mirror client-side AC / edge-case constraints |

## Informational notes

- `ActiveQuestBadge` in `town-square.tsx` renders the title of every active quest but only attaches the "View in War Room" link to `activeQuests[0]`. With more than one active quest, the others are read-only labels. Phase 3 only requires "show a small 'Active quest: {title}' badge with a link" — the current behavior satisfies that for the common single-active-quest case. Worth revisiting if multi-active-quest becomes common (Phase 4+).
- The Library context textarea has no `maxLength` and no length constraint in either the client or the server schema. The spec did not specify one; this matches the spec but is worth a follow-up once a sensible upper bound is known.
- The new building tests (`library.test.tsx`, `oracle.test.tsx`, `tavern.test.tsx`) trigger a few "update inside a test was not wrapped in act(...)" warnings during the persistent-error-path tests. The tests still pass and assert the right behavior; the warning is non-blocking but could be silenced by wrapping the trailing rerender in `act()`.
- Cross-boundary cleanliness aside from bug #4: the diff does not touch any SQL migration or DB enum, so no CHECK-constraint / UI mismatch surface was introduced.

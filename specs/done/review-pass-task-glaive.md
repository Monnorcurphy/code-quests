# Review pass — task glaive (Party Map peek-overlay)

## Verdict: FAIL — 4 bugs filed (1 HIGH, 3 LOW)

## Checks performed

- Read each new file once: `app-shell.tsx`, `party-map.tsx`, `use-active-quests.ts`, `scene-display-name.ts`, both test files, the updated `main.tsx`.
- Read supporting context once: `lib/api.ts` (`api.quests.active` returns `Quest[]`), `stores/quest-store.ts` (currentSceneByQuest / statusByQuest), `shared/src/quest.ts` (QuestStatus + QuestSceneKey enums), `routes/quests.ts` (`/active` SQL filter).
- Ran `pnpm --filter @code-quests/client test` — 35 files / 424 tests passing (includes the 21 new party-map tests).
- Ran `pnpm --filter @code-quests/client typecheck` — clean.
- Ran `pnpm --filter @code-quests/client lint` — clean.
- Ran `pnpm --filter @code-quests/client build` — succeeds.
- Grepped for hardcoded secrets (`sk-`, `AKIA`, `api_key`, `password=`) under `packages/client/src/features/party-map` — none.
- Cross-checked enum boundaries:
  - `QuestStatus` (shared) ⇄ `STATUS_LABELS` keys in `party-map.tsx` — all six statuses covered (idle, active, complete, failed, paused_input, user_blocked).
  - `QuestSceneKey` (shared) ⇄ `SCENE_DISPLAY_NAMES` in `scene-display-name.ts` — all four scenes covered.
- Verified `pointer-events: none` on outer wrapper + `pointer-events: auto` on inner controls → Phaser canvas underneath remains clickable (spec requirement met, asserted by `renders party-map with pointer-events none on wrapper` test).
- Verified collapsed→expanded toggles via mouse click, Enter key, and Escape — all covered with unconditional assertions.
- Verified `MAX_ROWS = 8` cap is enforced and tested.
- Verified `currentScene` / `status` store-overrides are merged ahead of API values (asserted by use-active-quests test).
- Verified `AdventurerName` query is gated on a non-null `adventurerId` and falls back to "Unknown" / "…".
- Verified `useNavigate('/quest/:questId')` wiring and tested.
- Verified file lengths: `party-map.tsx` is 178 lines (≤ 250 spec / ≤ 300 rule limit); other files well under.
- No `console.log` in any touched source file.
- Tests use unconditional assertions (no `if (element.isVisible())` patterns).
- Cross-checked the spec's stated coverage list against the test file — the first four bullets are covered; the fifth (axe-core scan) is missing → bug 1.

## Bugs filed

1. **review-1.md (HIGH)** — Spec requires "axe-core scan: zero violations" in the test coverage; no axe-core (or `jest-axe`) scan was added in either the vitest test or an E2E spec.
2. **review-2.md (LOW)** — Empty-state hint mentions the War Room but provides no actionable link/button. Violates the "what do I do next?" UX principle.
3. **review-3.md (LOW)** — Banner count / loading text changes are not in an `aria-live` region, and `aria-busy` is not set while the initial fetch is pending. Loading-state announcement rule from `ux-feedback.md` not met.
4. **review-4.md (LOW)** — `useActiveQuests` ignores `useQuery`'s `error`; a failed `/quests/active` request silently renders `⚔ No quests`. Silent error swallowing pattern from `common-findings.md` #8.

## Informational notes (not bugs)

- **Status badges other than `Active` only reachable transiently in production.** The server's `/quests/active` endpoint only returns `WHERE q.status = 'active'`. The merge in `use-active-quests` overlays `statusByQuest` from the store, so a websocket-driven transition (e.g. `active → paused_input`) will surface the new status for the ~5s window between polls before the quest drops out of the API result. The status mapping in `STATUS_LABELS` is defensive (covers all six) and the unit test exercises `paused_input`. Worth a follow-up if product wants paused/blocked quests to keep appearing — that would require widening the `/active` filter (or adding a separate `/quests/in-progress` endpoint).
- **`AdventurerName` swallows query errors.** If `GET /adventurers/:id` fails, the row stays at "…" forever. Acceptable for a peripheral display but tracked here so it's not lost.
- **Outer wrapper `<div aria-label="Party Map">` has no `role`.** ARIA label on a plain `<div>` may be ignored by assistive tech. Either remove (the button's accessible name already covers it) or upgrade to a `role="complementary"` landmark. Folded into review-3.md fix.
- **`MemoryRouter` in `party-map.test.tsx` is technically unused** — `useNavigate` is mocked, and `<PartyMap />` doesn't consume any other router context. Cleanup opportunity, not a bug.
- **`AdventurerName.queryFn` has dead-code branch.** The `: Promise.resolve(null)` fallback is unreachable because the query is gated by `enabled: adventurerId !== null`. Harmless, but `queryFn: () => api.adventurers.get(adventurerId!)` would be cleaner once `enabled` is set.

# Review pass — TASK golconda (Phase 4 capstone)

**Verdict:** FAIL — 2 HIGH + 1 LOW bugs filed.

## Checks performed

| Check | Result |
|---|---|
| `pnpm typecheck` | PASS (clean across all packages) |
| `pnpm lint` | PASS (zero errors / warnings) |
| `pnpm build` | PASS (vite + tsc clean) |
| `pnpm test` (vitest) | PASS — 324 client tests, 204 server tests, 0 failures |
| Secrets grep (`sk-`, `AKIA`, `api_key=`, `password=`) | Clean (only false-positive on `pnpm` in `002_seed_equipment.sql`) |
| `console.log/debug/info` in production source | Clean |
| Banned Tailwind contrast classes (`text-{gray,neutral,slate,zinc}-{100..400}`) | Clean |
| `pnpm test:e2e` | NOT INDEPENDENTLY VERIFIABLE — host dev server is currently running from a stale worktree (`.claude/worktrees/phase-2-demo`); see review-2.md regardless |
| Cross-boundary check: `events_json` (AgentEvent[]) write/read | Consistent — seed-dev writes shape matches `AgentEventSchema` and `GET /quests/returned` JSON.parse path |
| Cross-boundary check: quest status terminal value `complete` (not `completed`) | Consistent across seed, routes, schema |
| DB FK pragma | Enabled in `db/connection.ts` (`db.pragma('foreign_keys = ON')`) |
| Capstone coverage (all Phase 4 features reachable from Town Square) | PASS — War Room (dispatch + active panel + cancel button), Town Square peek, Hall of Returns scene + badge, returned-quest detail modal — all reachable |
| New e2e specs created (`phase-4-capstone.spec.ts` + `phase-4-cancel.spec.ts`) | Present but contain breaking selector and seed-dependency issues (see review-1, review-2) |

## Bugs filed

| ID | Severity | Summary |
|---|---|---|
| review-1 | HIGH | `phase-4-cancel.spec.ts` `getByRole('button', { name: 'View quest: …' })` will throw strict-mode violation because active quests render duplicate buttons in both `ActiveQuestPeekItem` and `QuestBoard` |
| review-2 | HIGH | E2E tests depend on a manually-run seed; spec acceptance criterion #1 promises `pnpm install && pnpm dev` self-bootstraps |
| review-3 | LOW | README labels seed step "Optional" but the walkthrough names the seeded quest by literal title |

## Informational notes (not filed as bugs)

- **`monsterTypeId: 'imp_typecheck'` in seed-dev.ts:137** references a monster type that does not exist in any migration. This is permitted today (events_json has no FK) and forward-compatible per the Phase 6 carry-forward note in the spec, but mention it as something Phase 6 will need to either backfill or null out when wiring real `MonsterEncounter` records.
- **`DispatchButton` 3-second auto-close** (`dispatch-button.tsx:39-42`) fires `setActiveModal(null)` 3 s after a successful dispatch. The offline adapter completes in tens of ms so the war-room re-renders into the `'complete'` terminal branch and unmounts DispatchButton (clearing the timer), so this works in practice — but if a future agent adapter is slower than 3 s the user would be kicked back to Town Square before they see "Quest complete!" Worth a comment or a longer timeout once real-agent timings are measured in Phase 5+.
- **Cancel "Cancelling…" loading state** (`cancel-button.tsx:151-160`) is visible only while `mutate()` is in flight. With no real subprocess to SIGTERM (the cancel route only updates the DB row), the window is sub-100 ms; the `cancel button has all three UX states` Playwright test relies on Playwright's auto-retry to catch it. Likely flaky under load. Not blocking — keep an eye on this.
- **Phase 9 forward links**: README phase roadmap correctly notes Re-post / Retire buttons land in Phase 9 and `ReturnedQuestDetail` already exposes a "Coming in Phase 9" copy block — no no-op handlers shipped. Good.

## Recommendation

Fix review-1 and review-2 before merging. review-3 is a copy fix that can ride along.

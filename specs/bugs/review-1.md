# BUG: Cross-boundary schema violations in capture-walkthrough.spec.ts mock data

**Severity:** CRITICAL
**File(s):** `packages/client/tests/e2e/capture-walkthrough.spec.ts`

## Problem

The Playwright capture spec mocks REST responses for `/quests`, `/quests/active`, `/quests/:id`, and `/hall-of-returns/quests`. The client wraps every response through Zod validators (`QuestSchema.parse(data)` in `packages/client/src/lib/api.ts:135`). Several mock fixtures violate those schemas, so `fetchJson` throws, React Query marks the queries as errored, and the demo UI never renders for the screenshot. The walkthrough doc (`specs/done/phase-11-walkthrough.md`) advertises screenshots of states that will not actually appear.

Concretely:

1. **`currentScene` enum mismatch (steps 1–10).**
   - `MOCK_SHOWCASE_QUESTS[0..2].currentScene = null` — `QuestSchema.currentScene` is `QuestSceneKeySchema.default('quest-forest')`, but Zod `.default()` only applies to `undefined`; explicit `null` fails the strict enum.
   - `MOCK_QUESTS_ACTIVE[0..2].currentScene = 'dungeon' | 'cave' | 'forest'` — valid values are `'quest-forest' | 'quest-cave' | 'quest-dungeon' | 'quest-boss-room'` (`packages/shared/src/quest.ts:23-28`). The entire codebase uses the prefixed form (28 production files).
   - Same problem in `tessCopyActive`, `rookMeterActive`, `brielleJwtActive` overrides (lines ~375, 408, 440).

2. **`specAudit` missing required field (steps 1–4).**
   - `MOCK_SHOWCASE_QUESTS[*].specAudit = { gaps: [] }` — `SpecAuditSchema` (`packages/shared/src/spec-audit.ts:20-24`) requires `runAt: z.string().min(1)`. Either pass `null` (the schema is nullable) or include `runAt` and `bypassed: false`.

3. **`failureSummary.recommendation` invalid enum (steps 8–9).**
   - `MOCK_JWT_FAILED.failureSummary.recommendation = 'repost_with_new_equipment'` — `FailureSummaryRecommendationSchema` (`packages/shared/src/quest.ts:32-38`) only accepts `'retry' | 'repost_with_clarification' | 'retire' | 'break_into_smaller' | 'level_up_first'`. The same invalid value appears in `MOCK_POST_MORTEM_JWT.failureSummary`.

4. **`setInputRequest` payload shape (step 7).**
   - Lines 454-457 call the store with `{ prompt, requestedAt }`, but `InputRequestSchema` (`packages/shared/src/quest.ts:5-10`) defines `{ question, awaitingSince, context?, adventureFraming? }`. The PAUSED_INPUT modal renders `request.question`, which will be `undefined` — step 7 screenshot will show an empty question.

5. **`monster_appeared` event missing required `encounterId` (steps 5–6).**
   - Lines 389-398 and 421-430 dispatch the event with `questId` instead of the required `encounterId` (`packages/shared/src/agent.ts:55-64`). The encounter store reads `event.encounterId` directly into `ActiveEncounter.encounterId`, producing `undefined`. Downstream consumers (HUD overlay, post-mortem rendering) may break.

The test also never calls `expect()`, so all of the above failures pass silently and only manifest as blank/error screenshots committed to `assets/screenshots/phase-11/`.

## Expected

Per the review contract (Boundary Contract Validation, Cross-Boundary Type Safety rules):
> Mocked boundaries (mocked `invoke()`, `fetch()`, etc.) hide these mismatches — tests pass but the app crashes at runtime.

Every value flowing into the client through a mocked route must satisfy the receiving Zod schema. The capture spec must produce the actual demo screenshots described in `specs/done/phase-11-walkthrough.md`, otherwise the deliverable (a walkthrough doc backed by screenshots) is broken.

## Fix

In `packages/client/tests/e2e/capture-walkthrough.spec.ts`:

1. **`currentScene`** — replace every short scene key with the prefixed form, and replace `null` initial values with `'quest-forest'` (or omit the field entirely so the default applies):
   ```ts
   // MOCK_SHOWCASE_QUESTS
   currentScene: 'quest-forest',
   // MOCK_QUESTS_ACTIVE
   { ...MOCK_SHOWCASE_QUESTS[0], status: 'active', adventurerId: ADV_BRIELLE, agentId: 'agent-brielle', currentScene: 'quest-dungeon' },
   { ...MOCK_SHOWCASE_QUESTS[1], status: 'active', adventurerId: ADV_TESS, agentId: 'agent-tess', currentScene: 'quest-cave' },
   { ...MOCK_SHOWCASE_QUESTS[2], status: 'active', adventurerId: ADV_ROOK, agentId: 'agent-rook', currentScene: 'quest-forest' },
   // also tessCopyActive (line ~375), rookMeterActive (~408), brielleJwtActive (~440)
   ```

2. **`specAudit`** — either set to `null` or provide the full shape:
   ```ts
   specAudit: { runAt: '2026-05-28T10:00:00.000Z', gaps: [], bypassed: false },
   ```

3. **`failureSummary.recommendation`** — use a valid enum value (e.g. `'repost_with_clarification'`) in both `MOCK_JWT_FAILED` and `MOCK_POST_MORTEM_JWT`, and update the walkthrough copy ("Re-post with new equipment") to match the visible recommendation label.

4. **`setInputRequest` payload** — rename fields:
   ```ts
   store?.getState().setInputRequest(questId, {
     question: 'Which JWT library should I use — jose or jsonwebtoken? ...',
     awaitingSince: new Date().toISOString(),
   });
   ```

5. **`monster_appeared` events** — replace `questId` with `encounterId` in both calls (lines 389-398 and 421-430):
   ```ts
   store?.getState().handleAgentEvent(questId, {
     type: 'monster_appeared',
     encounterId: 'enc-grognak-tess',  // and 'enc-imp-rook' for Rook
     monsterId: 'grognak-the-lint-goblin',
     ...
   });
   ```

6. **Add at least one assertion per step** (sanity check that the screenshot is not a pure error page), e.g. `await expect(page.getByText(/Modernize the Auth System/)).toBeVisible();` in step 2. Without assertions the spec silently produces broken artifacts.

7. After fixing, run `pnpm test:e2e --grep "Showcase walkthrough"` and verify all 12 PNGs land in `assets/screenshots/phase-11/` and match the walkthrough narrative.

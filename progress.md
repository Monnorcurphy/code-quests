# Progress — Phase 11

Previous task progress archived to metrics/progress-before-aries.md

## Task aries — Auto-match deterministic demo path

**Status:** Complete

**Changes:**
- `packages/server/src/services/auto-match.ts` — Added final id-lexicographic tiebreak for full determinism. Added exported `autoMatchWithReason()` returning adventurer + plain-language reason string.
- `packages/server/src/services/__tests__/auto-match-showcase.test.ts` — New test verifying all three showcase quests deterministically match the right adventurers (Brielle→JWT, Tess→copy, Rook→meter), and that results are order-independent.
- `packages/server/src/__tests__/auto-match-route.test.ts` — Tests for `GET /quests/:id/auto-match` endpoint (404, no-adventurer, matched adventurer, showcase scenario).
- `packages/server/src/routes/quests.ts` — New `GET /:id/auto-match` route returning `{ adventurerId, adventurerName, adventurerClass, reason }`.
- `packages/client/src/lib/api.ts` — Added `api.quests.autoMatch(id)` function with Zod schema; updated `dispatch` to accept optional `adventurerId` param.
- `packages/client/src/features/quests/auto-match-preview.tsx` — New React component showing auto-match suggestion + reason + override dropdown. Full loading/error/empty states per ux-feedback rules.
- `packages/client/src/features/quests/dispatch-button.tsx` — Accepts optional `adventurerId` prop, passes through to API dispatch call.
- `packages/client/src/features/war-room.tsx` — Integrated AutoMatchPreview into idle quest detail section; lifted adventurer selection state to WarRoom; fetches adventurers for dropdown.
- `packages/client/src/__tests__/auto-match-preview.test.tsx` — New component tests: loading state, suggestion display, error state, empty-guild state, auto-selection callback, dropdown override.
- `packages/client/src/__tests__/dispatch-button.test.tsx` — Updated assertion to include new adventurerId argument.

**Verification:** All 1615 tests pass (83 shared + 547 server + 985 client). Zero lint/typecheck errors.

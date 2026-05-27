# Progress — Phase 3

Previous task progress archived to metrics/progress-before-emerald.md

## emerald — Spec-audit warning UI + town-routing chips

**Status:** Complete

**What was built:**
- `POST /quests/:id/audit` server endpoint — runs `auditQuest()`, persists result to `spec_audit_json`, returns `SpecAudit`
- `api.quests.audit(id)` client method for calling the endpoint
- `use-run-audit.ts` — TanStack Query mutation hook with cache invalidation
- `gap-chip.tsx` — accessible chip with "BLOCKING" text label for block-severity gaps, "Go to {building}" button with full aria-label
- `spec-audit-panel.tsx` — renders null/empty/gap states with GapChip list and "Run audit" button (loading/success/error states)
- `town-store.ts` — added `goToBuilding(building)` action mapping SpecGapBuilding to SceneKey via `sceneRouter.emitDoorEnter`
- `war-room.tsx` — redesigned to show quest detail view (with SpecAuditPanel + run audit) when selectedQuestId is set, draft form otherwise; success auto-dismisses after 3s
- `quest-board.tsx` — cards are now clickable buttons opening War Room with the quest selected; "✓ Ready" / "⚠ N gaps" audit badges shown per card
- CSS — gap chip pulse animation (disabled under prefers-reduced-motion), spec-audit-panel, quest-audit-badge, gap-chip styles
- Server tests: 4 new tests for `POST /quests/:id/audit`
- Client tests: 13 new tests for `SpecAuditPanel` covering null/pass/gaps states, BLOCKING label, chip navigation, aria-labels, run audit button states

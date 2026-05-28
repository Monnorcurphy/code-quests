# Progress — Phase 5

Previous task progress archived to metrics/progress-before-glaive.md

## glaive — Party Map peek-overlay

- Created `packages/client/src/features/party-map/scene-display-name.ts` — maps QuestSceneKey to human-friendly display names
- Created `packages/client/src/features/party-map/use-active-quests.ts` — hook polling `/quests/active` every 5s, merging store's currentScene/status on top
- Created `packages/client/src/features/party-map/party-map.tsx` — collapsed banner (⚔ N active), expandable list of up to 8 rows; keyboard-accessible; pointer-events:none wrapper
- Created `packages/client/src/components/app-shell.tsx` — thin shell wrapper that mounts `<PartyMap />` globally
- Modified `packages/client/src/main.tsx` — wrap `<App />` in `<AppShell>` so PartyMap is visible from all routes
- Tests: `__tests__/party-map.test.tsx` (13 cases), `__tests__/use-active-quests.test.ts` (7 cases)
- All 424 tests pass; typecheck clean; lint clean; build succeeds

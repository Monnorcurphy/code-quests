### TASK bodiam: React HUD skeleton

**Goal:** Stand up the Vite + React client with TanStack Query, Zustand, react-router, and a Town-themed shell that loads. No Phaser yet — this is pure HTML/CSS/React.

**Files to create/modify:**
- `packages/client/index.html`, `packages/client/vite.config.ts`
- `packages/client/src/main.tsx`, `packages/client/src/app.tsx`
- `packages/client/src/lib/api.ts` — typed fetch wrappers using shared Zod schemas to parse responses
- `packages/client/src/lib/query-client.ts` — TanStack Query setup
- `packages/client/src/routes/town.tsx` — Town Square shell with 8 building panels (Town Square, War Room, Oracle, Library, Tavern, Armory, Guild Hall, Hall of Returns) as plain styled cards/buttons. Each opens a placeholder modal saying "Coming in Phase 2 — Phaser scene".
- `packages/client/src/styles/*` — basic medieval-themed CSS (parchment off-white, stone gray, banner-red accents). No external CSS framework required for Phase 1; can use Tailwind if preferred but Tailwind setup must follow `rules/builder/build-checklist.md`.
- `packages/client/src/__tests__/town.test.tsx` — render test + nav test

**Acceptance criteria:**
- `pnpm --filter @code-quests/client dev` launches Vite and serves the Town view
- Town Square renders all 8 building entries
- Clicking any building opens the placeholder modal (no console errors)
- All contrast ratios ≥ 4.5:1 (no `text-gray-400` family — per `rules/domain/frontend/accessibility.md`)
- Keyboard nav works: Tab through buildings, Enter to open, Escape to close
- Render test + at least one interaction test pass

---


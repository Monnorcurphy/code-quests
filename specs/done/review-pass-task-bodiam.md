# Review Pass — TASK bodiam (React HUD skeleton)

## Scope reviewed

The actual bodiam commit (`19f1c68 feat(bodiam): React HUD skeleton`) — the rest of the diff against `main` belongs to earlier tasks (alhambra, arundel, ashford, balmoral) and is out of scope here. Files reviewed:

- `packages/client/index.html`, `vite.config.ts`, `tsconfig.json`, `vitest.config.ts`, `package.json`
- `packages/client/src/main.tsx`, `app.tsx`
- `packages/client/src/routes/town.tsx`
- `packages/client/src/lib/api.ts`, `lib/query-client.ts`
- `packages/client/src/styles/global.css`
- `packages/client/src/__tests__/town.test.tsx`, `app.test.tsx`, `test-setup.ts`

## Verification

| Check | Result |
|---|---|
| `pnpm --filter @code-quests/client test` | PASS — 12/12 tests |
| `pnpm --filter @code-quests/client typecheck` | PASS — no errors |
| `pnpm --filter @code-quests/client lint` | PASS — 0 errors / 0 warnings |
| `pnpm --filter @code-quests/client build` | PASS — vite build succeeds |
| Secret scan (`sk-`, `AKIA`, `api_key`, `password=`) | Clean |
| `console.*` in production source | None |
| Tailwind contrast safelist (`text-{gray,neutral,slate,zinc}-{100,200,300,400}`) | Not used (custom CSS palette) |

## Accessibility audit

- `:focus-visible` outline defined globally (3px solid banner-red with offset) ✓
- Modal has `role="dialog"`, `aria-modal="true"`, `aria-labelledby` ✓
- Building buttons have descriptive `aria-label="Enter <Name> — <Role>"` ✓
- Building list uses `<ul role="list">` with `<button>` children — semantic ✓
- `prefers-reduced-motion` honored on `.building-btn` and `.modal-close` transitions ✓
- Keyboard: Enter opens, Escape closes, focus returns to trigger on close ✓
- Contrast (manual luminance check):
  - body text `#2c2416` on parchment `#f5f0e8` — ~12:1 ✓
  - secondary `#5a4e3a` on parchment — ~7.4:1 ✓
  - banner-red `#8b1a1a` (button text on parchment) — ~5.6:1 ✓
  - white on banner-red modal close button — ~9.5:1 ✓
  - stone-border `#8a8a78` on parchment (decorative borders) — ~3.15:1 ≥ 3:1 ✓

## Bugs filed

| # | Severity | Title |
|---|---|---|
| 1 | HIGH | Modal lacks focus trap — Tab escapes to background buttons |
| 2 | LOW | Modal effect depends on unstable `onClose` callback (focus re-snap risk) |

## Informational notes (no bugs filed)

- **`api.ts` `BASE_URL` hardcoded to `http://localhost:4001`** — fine for Phase 1, but should move to a Vite `import.meta.env.VITE_API_BASE_URL` (with a default) before Phase 2 introduces real fetches. The shared Zod schemas are wired correctly to the server-side enum / DB constraints (verified by reading `packages/shared/src/quest.ts` exports).
- **`api.ts`, `query-client.ts`, and Zustand are scaffolded but not yet exercised** — consistent with the spec ("Stand up Vite + React with TanStack Query, Zustand, react-router"). No store exists yet; that is expected for Phase 1.
- **Tests use `expect(...).toBeDefined()` rather than `@testing-library/jest-dom`'s `.toBeInTheDocument()`** — functionally equivalent here because `getByRole`/`getByText` throw on miss, but `.toBeInTheDocument()` is the idiomatic matcher and would also work with `queryBy*` if added later. `@testing-library/jest-dom` is already imported in `test-setup.ts` — switching is a 1-line fix per assertion.
- **Background page is not marked `inert` / `aria-hidden` while modal is open** — covered as part of bug #1 (focus trap), but worth noting it would also help screen-reader users by hiding background buttons from the accessibility tree.
- **Body scroll is not locked while modal is open** — minor UX concern; not strictly required by spec or rules.
- **`Town Square` building card opens the same placeholder modal as the others** — matches the spec literally ("8 building entries … each opens a placeholder modal"); the broader Town shell is the surrounding page, which feels right.
- **Modal renders inside `<main>` rather than via a portal** — acceptable for a scaffold; consider a portal in Phase 2 once Phaser scenes mount.

## Cross-boundary checks

- Shared schemas (`AdventurerSchema`, `QuestSchema`, `EpicSchema`) are consumed by `api.ts` directly — no value drift possible at this layer.
- No DB / IPC boundary touched by this task; nothing else to validate.

## Capstone coverage

Not the last task of the phase — capstone check not applicable.

## Verdict

**FAIL** — 2 bugs filed (1 HIGH, 1 LOW). The HIGH (focus-trap) must be fixed before Phase 1 closes; the LOW is a small refactor that prevents future focus-snap regressions.

### TASK alhambra: Monorepo + tooling setup

**Goal:** Initialize a pnpm monorepo with strict TypeScript, ESLint, Vitest, and a working `pnpm install && pnpm build && pnpm test && pnpm lint && pnpm typecheck` chain.

**Files to create/modify:**
- `package.json` — root, workspaces config, scripts that fan out
- `pnpm-workspace.yaml`
- `tsconfig.base.json` — strict mode
- `.eslintrc.cjs` (or flat config) — `@typescript-eslint/recommended`, `no-console: error`
- `packages/server/package.json`, `packages/server/tsconfig.json`
- `packages/client/package.json`, `packages/client/tsconfig.json` (Vite + React)
- `packages/shared/package.json`, `packages/shared/tsconfig.json`
- A minimal "hello world" entry in each package so `pnpm build` and `pnpm test` actually pass

**Acceptance criteria:**
- `pnpm install` succeeds from a clean checkout
- `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck` all exit 0
- `tsc --noEmit` finds zero `any` and strict mode is enforced
- Each package emits at least one passing Vitest test (smoke)

---


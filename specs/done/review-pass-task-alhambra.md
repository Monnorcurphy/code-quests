# Review Pass — TASK alhambra (Monorepo + tooling setup)

**Branch:** feature/alhambra
**Reviewer:** adversarial code reviewer (separate session from builder)
**Result:** FAIL — 2 bugs filed (1 HIGH, 1 LOW)

## Checks performed

1. **Read pre-computed diff** — 30 changed files, +3963/-9 lines (most volume is `pnpm-lock.yaml`). Reviewed every non-lockfile file.
2. **Read task spec** — `metrics/task-alhambra-context.md`. Acceptance: `pnpm install/build/test/lint/typecheck` all exit 0; strict TS; one passing Vitest per package.
3. **Ran verify commands locally**:
   - `pnpm test` — 6 tests across 3 packages, all pass.
   - `pnpm lint` — 0 errors.
   - `pnpm typecheck` — 0 errors, strict mode enforced.
4. **Hardcoded secrets** — grepped `sk-`, `AKIA`, `api_key=`, `SECRET_KEY`, `PRIVATE_KEY`, `password=` across `packages/` and `checks/`. None in product code.
5. **Accessibility** — `app.tsx` uses semantic `<main>` and `<h1>`. No interactive elements yet, so no keyboard/focus concerns. No Tailwind contrast safelist violations (no Tailwind configured yet).
6. **Cross-boundary validation** — No DB migrations, no DB constraints, no API request/response schemas, no Zod schemas. The only shared boundary types live in `packages/shared/src/index.ts` and are not yet consumed by `client` or `server`.
7. **ESLint configuration** — `no-console: error` and `@typescript-eslint/no-explicit-any: error` are present (matches `code-quality.md` and `typescript.md` rules).
8. **TypeScript strict mode** — `tsconfig.base.json` enables `strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`. All three packages inherit it.
9. **Debug prints** — No `console.log` / `console.error` / `console.warn` in any package source. Verify report shows a `WARN` for debug-prints but no actual occurrences in product code.
10. **File naming** — `app.tsx`, `main.tsx`, `index.ts`, `index.test.ts` — all kebab-case (typescript.md rule).
11. **Behavioral verification** — Confirmed via `node packages/server/dist/index.js &` + `kill -0` that the server process exits immediately (no `app.listen()` call). See `review-1.md`.

## Bugs filed

- **review-1.md (HIGH)** — Server `dev` script (`node dist/index.js`) does not actually start a server. `app.listen()` is never called, so the process exits on import. The factory smoke test passes only because Vite (5173) happens to be up. Also fails on a clean checkout (no `dist/` yet → `MODULE_NOT_FOUND`).
- **review-2.md (LOW)** — `checks/smoke-test.sh` orphans child processes (only kills the pnpm parent PID, not the spawned vite/node children), uses a fragile fixed 5s sleep, and uses `||` between client/server probes so a regression in either side is hidden.

## Informational notes (not bugs)

- **Factory profile modification** — The diff modifies `factory/profile.yaml` (replacing inline `smoke_test:` heredoc with `bash checks/smoke-test.sh`). Constitution rule 3 says *"Factory scripts and rules cannot be modified by builder/fixer agents. Changes to the factory require explicit human approval via PR."* The change is reasonable (YAML heredocs are fragile and extracting to a script aids review), but the human PR reviewer should be aware they are approving a factory change as part of this task.
- **Shared package not yet consumed** — Neither `packages/client/package.json` nor `packages/server/package.json` declares `@code-quests/shared` as a dependency. Expected at this foundation stage; future tasks will wire it up. Without a dependency edge, `pnpm -r build` may build in any order — still fine because nothing imports across packages yet.
- **`strict-peer-dependencies=false`** in `.npmrc` disables strict peer-dependency checking. Common in monorepos but can hide real peer mismatches. Worth a follow-up to revisit once more deps land.
- **`packages/server/src/index.test.ts` reaches into `app._router?.stack`** — that's Express's private internals and may break in Express 5.x. Acceptable for a smoke test today; consider replacing with an HTTP-level test (`supertest` against `/health`) when the server gains real routes.
- **`packages/shared/src/index.test.ts` only type-asserts literal values** — meets the "smoke" requirement of the spec but doesn't validate any real behavior. Will need to grow as the shared types do.
- **Tests do not exercise wrong/invalid input** — per `input-validation.md` rule 5, "Test with wrong data, not just right data." Acceptable today because there is no validation logic yet; flag for the task that introduces Zod schemas.

## Verdict

**FAIL** — 2 bugs filed (review-1.md HIGH, review-2.md LOW). The HIGH bug is the headline: a misconfigured `dev` script that silently produces a non-functional backend while the smoke test reports green.

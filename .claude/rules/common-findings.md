# Common Review Findings

Patterns caught by reviewers across multiple tasks and projects. Builders: check this list BEFORE committing. Fixing these upfront saves a fix round.

## 1. Contrast violations (5 tasks, all phases)

- Using `text-neutral-400`, `text-gray-400`, `text-slate-400` which fail WCAG 4.5:1
- Fix: use `-600` or darker for body text, `-500` minimum for secondary text
- See `rules/domain/frontend/accessibility.md` for the full Tailwind safelist

## 2. Debug output left in production code (3 tasks)

- Test files are fine, but application source must not have `console.log`, `print()`, `println!`, or equivalent
- Fix: remove before committing, or use a structured logger
- Enforce via linter: ESLint `no-console: error`, Clippy warnings, etc.

## 3. Cross-boundary value mismatches (2 tasks)

- Frontend select/radio option values don't match DB CHECK constraints or backend enum variants
- Zod schemas allow values that the DB rejects (or vice versa)
- Fix: read the migration SQL and verify enum values match on both sides
- Mocked calls hide these — they only surface at runtime. You must check manually.

## 4. Dead code and stale imports (3 tasks)

- Unused imports, unused variables, commented-out code left behind
- Fix: run your linter — most catch unused declarations
- Commented-out code is never the right answer — delete it (git has history)

## 5. Missing empty states (2 tasks)

- New pages/views render blank when no data exists or a service isn't configured
- Fix: every view that depends on data needs a helpful empty state message
- Empty states should explain what the user should do next ("No LLM configured — go to Settings")

## 6. Security: hardcoded secrets or missing headers (2 tasks)

- API keys appearing in source, missing Content-Security-Policy headers
- Fix: grep for `sk-`, `AKIA`, `api_key`, `password=` before committing
- Secrets belong in OS keychain or secret managers, never source

## 7. Build chain misconfiguration (silent failures)

- Tailwind configured but classes produce no CSS (missing PostCSS, missing import)
- ESLint rules set to 'warn' instead of 'error' — violations slip through
- Fix: verify the FULL chain end-to-end. See `rules/builder/build-checklist.md`

## 8. Silent error swallowing (18 tasks across 2 projects)

- Empty `catch {}` blocks — errors disappear, user sees nothing
- Rust `let _ =` discarding `Result` — DB/IO errors silently ignored
- `catch (e) { if (e instanceof Error)` — misses framework-specific error types (Tauri v2 errors are plain strings)
- Fix: every catch block must surface the error OR have `// intentionally swallowed: <reason>`
- Enforce via `checks/error-handling.sh`

## 9. Conditional test assertions (3 tasks)

- Tests wrap assertions in `if (element.isVisible())` — silently skip when false
- The test "passes" but validates nothing — bugs escape to production
- Fix: assertions must be unconditional. Assert that the element IS visible.
- Enforce via `checks/conditional-assertions.sh`

## 10. Missing FK pragma in SQLite (2 projects)

- SQLite disables foreign key enforcement by default
- Without `PRAGMA foreign_keys = ON`, all FK constraints are silently ignored
- Tests pass with orphaned rows and broken relationships
- Fix: set pragma in both production AND test database initialization
- Enforce via `checks/fk-pragma.sh`

## 11. LLM response struct fragility (8 tasks)

- Rust structs deserializing LLM output without `#[serde(default)]` crash on missing fields
- LLMs routinely omit optional fields, return wrong types, or produce partial JSON
- Fix: `#[serde(default)]` on all non-essential fields, `Option<T>` for optional data
- Enforce via `checks/serde-hygiene.sh`

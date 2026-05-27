# Build & Test Output — Context Protocol

When running build or test commands, ALWAYS filter output to avoid
filling the context window with noise. Unfiltered build output
has been measured at 6,000+ chars per invocation.

## Test commands

Pipe through a result filter — never run raw:

    <test-cmd> 2>&1 | tail -5

On failure, increase the tail to see the error:

    <test-cmd> 2>&1 | tail -30

If tests fail and you need the full error, re-run the specific
failing test WITHOUT the filter.

## Build / lint / typecheck

    <build-cmd> 2>&1 | tail -20
    <lint-cmd> 2>&1 | tail -20
    <typecheck-cmd> 2>&1 | tail -20

## Package installation

    <install-cmd> 2>&1 | tail -10

## Git diffs

**Reviewer agents**: the Ralph pipeline pre-computes the diff with lockfile
exclusions and embeds it in your prompt. Do NOT run your own `git diff`.

**Builder/Fixer agents**: always exclude lockfiles — they add thousands of chars with zero review value:

    git diff ... -- . ':!**/Cargo.lock' ':!**/pnpm-lock.yaml' ':!**/package-lock.json' ':!**/yarn.lock' ':!**/poetry.lock' ':!**/Pipfile.lock'

Use `--stat` first to see which files changed, then read the full diff.

## File discovery

Prefer using Glob/Grep tools over bash `find` — they respect
.gitignore and .ignore automatically. Never run `find` or `ls -R`
without excluding build artifacts (node_modules, target, __pycache__, etc.).

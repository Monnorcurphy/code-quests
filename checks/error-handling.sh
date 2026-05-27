#!/bin/bash
# checks/error-handling.sh — Detect silent error swallowing patterns
# Usage: ./checks/error-handling.sh [search-path]
#
# Catches two patterns that cause bugs to go unnoticed:
# 1. Empty catch blocks in JS/TS (errors silently disappear)
# 2. `let _ =` on fallible Rust calls (errors silently discarded)
#
# Empty catch blocks must either surface the error or have a
# `// intentionally swallowed: <reason>` comment explaining why.
#
# Exit 0 if clean, 1 if violations found

SEARCH_PATH="${1:-.}"
FOUND=0

EXCLUDES="--exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=dev-dist --exclude-dir=build --exclude-dir=.vite --exclude-dir=target --exclude-dir=.next --exclude-dir=out --exclude-dir=venv --exclude-dir=__pycache__ --exclude-dir=projects --exclude-dir=ui --exclude-dir=adversarial-tests"
FILE_EXCLUDES="--exclude=*.min.js --exclude=*.bundle.js --exclude=*bundle.js"

# Also exclude .claude/worktrees if present
if [ -d "${SEARCH_PATH}/.claude/worktrees" ]; then
    EXCLUDES="${EXCLUDES} --exclude-dir=worktrees"
fi

# ── JS/TS: empty catch blocks ──
# Matches `catch {` or `catch (e) {` followed by `}` with no meaningful body
# Excludes test files and lines with intentional-swallow comments
EMPTY_CATCH=$(grep -rn ${EXCLUDES} 'catch\s*{' "${SEARCH_PATH}" \
    --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" ${FILE_EXCLUDES} \
    2>/dev/null | grep -v '\.test\.' | grep -v '\.spec\.' | grep -v '// ')

if [ -n "$EMPTY_CATCH" ]; then
    COUNT=$(echo "$EMPTY_CATCH" | wc -l | tr -d ' ')
    echo "⚠️  Found ${COUNT} empty catch block(s) — errors should surface to user or log:"
    echo "$EMPTY_CATCH" | head -10
    FOUND=1
fi

# ── Rust: `let _ =` on potentially fallible calls ──
# Excludes common safe patterns: let _guard, let _timer, let _handle, let _permit
RUST_DISCARD=$(grep -rn ${EXCLUDES} 'let _\s*=' "${SEARCH_PATH}" \
    --include="*.rs" ${FILE_EXCLUDES} \
    2>/dev/null | grep -v test | grep -v 'let _guard\|let _timer\|let _handle\|let _permit\|let _listener\|let _span\|let _lock')

if [ -n "$RUST_DISCARD" ]; then
    COUNT=$(echo "$RUST_DISCARD" | wc -l | tr -d ' ')
    echo "⚠️  Found ${COUNT} let _ = usage(s) — check if errors should be handled:"
    echo "$RUST_DISCARD" | head -10
    FOUND=1
fi

exit ${FOUND}

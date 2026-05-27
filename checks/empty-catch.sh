#!/bin/bash
# checks/empty-catch.sh — Detect empty catch blocks and silent error swallowing
# Usage: ./checks/empty-catch.sh [search-path]
#
# Catches patterns that silently discard errors:
# 1. Empty catch blocks: catch {}, catch (e) {}, .catch(() => {})
# 2. .catch(() => undefined) — promise errors discarded
# 3. || true without logging context
# 4. 2>/dev/null without logging context
# 5. let _ = on Result types in Rust
#
# Exit 0 if clean, 1 if violations found

SEARCH_PATH="${1:-.}"
FOUND=0

EXCLUDES="--exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=dev-dist --exclude-dir=build --exclude-dir=.vite --exclude-dir=target --exclude-dir=.next --exclude-dir=out --exclude-dir=venv --exclude-dir=__pycache__ --exclude-dir=projects --exclude-dir=ui --exclude-dir=adversarial-tests --exclude-dir=core --exclude-dir=checks"
FILE_EXCLUDES="--exclude=*.min.js --exclude=*.bundle.js --exclude=*bundle.js"

# Also exclude .claude/worktrees if present
if [ -d "${SEARCH_PATH}/.claude/worktrees" ]; then
    EXCLUDES="${EXCLUDES} --exclude-dir=worktrees"
fi

# ── JS/TS: empty catch blocks ──
# catch {} / catch { } / catch (e) {} / catch (err) { }
EMPTY_CATCH=$(grep -rn ${EXCLUDES} -E 'catch\s*(\([^)]*\))?\s*\{\s*\}' "${SEARCH_PATH}" \
    --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" ${FILE_EXCLUDES} \
    2>/dev/null | grep -v '\.test\.' | grep -v '\.spec\.' | grep -v '// intentionally')

if [ -n "$EMPTY_CATCH" ]; then
    COUNT=$(echo "$EMPTY_CATCH" | wc -l | tr -d ' ')
    echo "❌ Found ${COUNT} empty catch block(s) — errors silently swallowed:"
    echo "$EMPTY_CATCH" | head -15
    FOUND=1
fi

# ── JS/TS: .catch(() => {}) or .catch(() => undefined) ──
PROMISE_SWALLOW=$(grep -rn ${EXCLUDES} -E '\.catch\(\s*\(\s*\w*\s*\)\s*=>\s*(\{\s*\}|undefined|null)\s*\)' "${SEARCH_PATH}" \
    --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" ${FILE_EXCLUDES} \
    2>/dev/null | grep -v '\.test\.' | grep -v '\.spec\.' | grep -v '// intentionally')

if [ -n "$PROMISE_SWALLOW" ]; then
    COUNT=$(echo "$PROMISE_SWALLOW" | wc -l | tr -d ' ')
    echo "❌ Found ${COUNT} promise .catch() swallowing error(s):"
    echo "$PROMISE_SWALLOW" | head -10
    FOUND=1
fi

# ── Shell: || true without comment/logging ──
OR_TRUE=$(grep -rn ${EXCLUDES} -E '\|\|\s*true\s*$' "${SEARCH_PATH}" \
    --include="*.sh" --include="*.bash" \
    2>/dev/null | grep -v '#' | grep -v '\.test\.' | grep -v '\.spec\.')

if [ -n "$OR_TRUE" ]; then
    COUNT=$(echo "$OR_TRUE" | wc -l | tr -d ' ')
    echo "⚠️  Found ${COUNT} '|| true' without comment — errors silently ignored:"
    echo "$OR_TRUE" | head -10
    FOUND=1
fi

# ── Shell: 2>/dev/null without logging ──
DEV_NULL=$(grep -rn ${EXCLUDES} -E '2>/dev/null\s*$' "${SEARCH_PATH}" \
    --include="*.sh" --include="*.bash" \
    2>/dev/null | grep -v '#' | grep -v 'echo\|printf\|log' | grep -v '\.test\.' | grep -v '\.spec\.')

if [ -n "$DEV_NULL" ]; then
    COUNT=$(echo "$DEV_NULL" | wc -l | tr -d ' ')
    echo "⚠️  Found ${COUNT} '2>/dev/null' without logging — consider logging failures:"
    echo "$DEV_NULL" | head -10
    FOUND=1
fi

# ── Rust: let _ = on potentially fallible calls ──
RUST_DISCARD=$(grep -rn ${EXCLUDES} -E 'let\s+_\s*=' "${SEARCH_PATH}" \
    --include="*.rs" \
    2>/dev/null | grep -v '\.test\.' | grep -v 'let _guard\|let _timer\|let _handle\|let _permit\|let _listener\|let _span\|let _lock')

if [ -n "$RUST_DISCARD" ]; then
    COUNT=$(echo "$RUST_DISCARD" | wc -l | tr -d ' ')
    echo "⚠️  Found ${COUNT} 'let _ =' in Rust — check if Result errors should be handled:"
    echo "$RUST_DISCARD" | head -10
    FOUND=1
fi

if [ "$FOUND" -eq 0 ]; then
    echo "✅ No silent error swallowing detected"
fi

exit ${FOUND}

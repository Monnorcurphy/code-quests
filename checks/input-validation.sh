#!/bin/bash
# checks/input-validation.sh — Detect missing input validation patterns
# Usage: ./checks/input-validation.sh [search-path]
#
# Catches common input validation failures:
# 1. dangerouslySetInnerHTML / innerHTML (XSS)
# 2. Unparameterized SQL (injection)
# 3. Unescaped querySelector with dynamic values (selector injection)
# 4. Raw string interpolation in SQL (format! with SQL keywords)
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

# ── XSS: dangerouslySetInnerHTML, innerHTML assignment ──
XSS_HITS=$(grep -rn ${EXCLUDES} 'dangerouslySetInnerHTML\|\.innerHTML\s*=' "${SEARCH_PATH}" \
    --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" ${FILE_EXCLUDES} \
    2>/dev/null | grep -v '\.test\.' | grep -v '\.spec\.' | grep -v node_modules)

if [ -n "$XSS_HITS" ]; then
    COUNT=$(echo "$XSS_HITS" | wc -l | tr -d ' ')
    echo "❌ Found ${COUNT} potential XSS vector(s) (innerHTML/dangerouslySetInnerHTML):"
    echo "$XSS_HITS" | head -10
    FOUND=1
fi

# ── SQL Injection: string interpolation in SQL-like strings ──
# Catches format!("SELECT ... {}", user_input) in Rust
SQL_INTERP=$(grep -rn ${EXCLUDES} 'format!.*SELECT\|format!.*INSERT\|format!.*UPDATE\|format!.*DELETE\|format!.*WHERE' "${SEARCH_PATH}" \
    --include="*.rs" ${FILE_EXCLUDES} \
    2>/dev/null | grep -v '\.test\.' | grep -v '\.spec\.' | grep -v 'const.*SELECT')

if [ -n "$SQL_INTERP" ]; then
    COUNT=$(echo "$SQL_INTERP" | wc -l | tr -d ' ')
    echo "❌ Found ${COUNT} potential SQL injection(s) — format! with SQL keywords:"
    echo "$SQL_INTERP" | head -10
    echo ""
    echo "Fix: use parameterized queries (? placeholders) instead of string interpolation"
    FOUND=1
fi

# Catches template literals with SQL in JS/TS
SQL_TEMPLATE=$(grep -rn ${EXCLUDES} '`.*SELECT.*\${\|`.*INSERT.*\${\|`.*UPDATE.*\${\|`.*DELETE.*\${' "${SEARCH_PATH}" \
    --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" ${FILE_EXCLUDES} \
    2>/dev/null | grep -v '\.test\.' | grep -v '\.spec\.' | grep -v node_modules)

if [ -n "$SQL_TEMPLATE" ]; then
    COUNT=$(echo "$SQL_TEMPLATE" | wc -l | tr -d ' ')
    echo "❌ Found ${COUNT} potential SQL injection(s) — template literal with SQL:"
    echo "$SQL_TEMPLATE" | head -10
    FOUND=1
fi

# ── Dynamic querySelector without CSS.escape ──
# Already covered by checks/contrast-classes.sh pattern in verify.sh
# but also check non-extension code
SELECTOR_HITS=$(grep -rn ${EXCLUDES} 'querySelector.*\${\|querySelector.*+\s*' "${SEARCH_PATH}" \
    --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" ${FILE_EXCLUDES} \
    2>/dev/null | grep -v 'CSS\.escape\|css\.escape' | grep -v '\.test\.' | grep -v '\.spec\.' | grep -v node_modules)

if [ -n "$SELECTOR_HITS" ]; then
    COUNT=$(echo "$SELECTOR_HITS" | wc -l | tr -d ' ')
    echo "⚠️  Found ${COUNT} dynamic querySelector without CSS.escape():"
    echo "$SELECTOR_HITS" | head -10
    FOUND=1
fi

exit ${FOUND}

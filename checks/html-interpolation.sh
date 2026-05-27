#!/bin/bash
# checks/html-interpolation.sh — Detect HTML injection vectors
# Usage: ./checks/html-interpolation.sh [search-path]
#
# Building HTML via string interpolation is an XSS vector.
# Catches:
# 1. Template literals with HTML tags and ${} interpolation
# 2. innerHTML = or .html() with dynamic values
# 3. dangerouslySetInnerHTML with non-sanitized input
# 4. String concatenation building HTML (<tag + variable)
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
FILE_TYPES='--include=*.ts --include=*.tsx --include=*.js --include=*.jsx'

# ── Template literals building HTML with interpolation ──
# Pattern: backtick string containing < and > (HTML tags) AND ${...}
HTML_TEMPLATE=$(grep -rn ${EXCLUDES} ${FILE_TYPES} ${FILE_EXCLUDES} -E '`[^`]*<[a-zA-Z][^`]*\$\{' "${SEARCH_PATH}" \
    2>/dev/null | grep -v '\.test\.' | grep -v '\.spec\.' \
    | grep -v '// safe\|// sanitized\|// escaped\|DOMPurify\|sanitize')

if [ -n "$HTML_TEMPLATE" ]; then
    COUNT=$(echo "$HTML_TEMPLATE" | wc -l | tr -d ' ')
    echo "❌ Found ${COUNT} template literal(s) building HTML with interpolation:"
    echo "$HTML_TEMPLATE" | head -10
    FOUND=1
fi

# ── innerHTML assignment with dynamic values ──
INNERHTML=$(grep -rn ${EXCLUDES} ${FILE_TYPES} ${FILE_EXCLUDES} -E '\.innerHTML\s*=\s*[^"'"'"']' "${SEARCH_PATH}" \
    2>/dev/null | grep -v '\.test\.' | grep -v '\.spec\.' \
    | grep -v '// safe\|DOMPurify\|sanitize\|"";\|'"''"';' \
    | grep -v '\.innerHTML\s*=\s*""' | grep -v "\.innerHTML\s*=\s*''")

if [ -n "$INNERHTML" ]; then
    COUNT=$(echo "$INNERHTML" | wc -l | tr -d ' ')
    echo "❌ Found ${COUNT} innerHTML assignment(s) with dynamic values:"
    echo "$INNERHTML" | head -10
    FOUND=1
fi

# ── .html() jQuery/cheerio calls with variables ──
HTML_CALL=$(grep -rn ${EXCLUDES} ${FILE_TYPES} ${FILE_EXCLUDES} -E '\.html\(\s*[^)'"'"'"][^)]*\)' "${SEARCH_PATH}" \
    2>/dev/null | grep -v '\.test\.' | grep -v '\.spec\.' \
    | grep -v 'DOMPurify\|sanitize\|\.html()\|\.html(\s*)' \
    | grep -v '\.toHTML\|text/html')

if [ -n "$HTML_CALL" ]; then
    COUNT=$(echo "$HTML_CALL" | wc -l | tr -d ' ')
    echo "⚠️  Found ${COUNT} .html() call(s) with dynamic content:"
    echo "$HTML_CALL" | head -10
    FOUND=1
fi

# ── String concatenation building HTML ──
HTML_CONCAT=$(grep -rn ${EXCLUDES} ${FILE_TYPES} ${FILE_EXCLUDES} -E "'<[a-zA-Z].*'\s*\+|\"<[a-zA-Z].*\"\s*\+" "${SEARCH_PATH}" \
    2>/dev/null | grep -v '\.test\.' | grep -v '\.spec\.' \
    | grep -v 'DOMPurify\|sanitize\|// safe')

if [ -n "$HTML_CONCAT" ]; then
    COUNT=$(echo "$HTML_CONCAT" | wc -l | tr -d ' ')
    echo "⚠️  Found ${COUNT} string concatenation(s) building HTML:"
    echo "$HTML_CONCAT" | head -10
    FOUND=1
fi

if [ "$FOUND" -eq 0 ]; then
    echo "✅ No HTML injection vectors detected"
fi

if [ "$FOUND" -eq 1 ]; then
    echo ""
    echo "Fix: use framework templating (React JSX, Vue templates) or DOMPurify.sanitize()"
fi

exit ${FOUND}

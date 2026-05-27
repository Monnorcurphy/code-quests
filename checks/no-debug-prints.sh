#!/bin/bash
# checks/no-debug-prints.sh — Detect debug prints in production code
# Usage: ./checks/no-debug-prints.sh [search-path]
# Exit 0 if clean, 1 if debug prints found
#
# Configurable: set DEBUG_PATTERNS env var to override defaults.
# Default patterns cover: JS/TS, Rust, Python, Go, Java, COBOL

SEARCH_PATH="${1:-.}"

DEFAULT_PATTERNS='console\.log\|print(\|println!\|fmt\.Print\|System\.out\.print\|DISPLAY'
PATTERNS="${DEBUG_PATTERNS:-${DEFAULT_PATTERNS}}"

EXCLUDES="--exclude-dir=.git --exclude-dir=node_modules --exclude-dir=target --exclude-dir=venv --exclude-dir=__pycache__ --exclude-dir=projects --exclude-dir=ui --exclude-dir=adversarial-tests --exclude-dir=core --exclude-dir=checks"

MATCHES=$(grep -rn ${EXCLUDES} "${PATTERNS}" "${SEARCH_PATH}" \
    --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
    --include="*.rs" --include="*.py" --include="*.go" --include="*.java" \
    --include="*.cbl" --include="*.cob" \
    2>/dev/null | grep -v '\.test\.' | grep -v '\.spec\.')

if [ -n "$MATCHES" ]; then
    echo "⚠️  Debug prints found in production code:"
    echo "$MATCHES" | head -20
    exit 1
fi

exit 0

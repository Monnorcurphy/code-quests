#!/bin/bash
# checks/conditional-assertions.sh — Detect conditional test assertions
# Usage: ./checks/conditional-assertions.sh [search-path]
#
# Tests that wrap assertions in `if (element.isVisible())` or
# `if (await element.isEnabled())` silently skip when the condition
# is false — the test passes but validates nothing.
#
# This pattern caused bugs to escape detection in Playwright and
# component test suites. Assertions must be unconditional.
#
# Exit 0 if clean, 1 if violations found

SEARCH_PATH="${1:-.}"

EXCLUDES="--exclude-dir=.git --exclude-dir=node_modules --exclude-dir=target --exclude-dir=venv --exclude-dir=__pycache__ --exclude-dir=projects --exclude-dir=ui --exclude-dir=adversarial-tests"

MATCHES=$(grep -rn ${EXCLUDES} 'if.*await.*isVisible\|if.*await.*isEnabled\|if.*isVisible()\|if.*isEnabled()' "${SEARCH_PATH}" \
    --include="*.test.*" --include="*.spec.*" \
    2>/dev/null)

if [ -n "$MATCHES" ]; then
    COUNT=$(echo "$MATCHES" | wc -l | tr -d ' ')
    echo "⚠️  Found ${COUNT} conditional assertion(s) in tests — assertions must be unconditional:"
    echo "$MATCHES" | head -10
    echo ""
    echo "Fix: assert the element IS visible/enabled, don't guard the assertion with if"
    exit 1
fi

exit 0

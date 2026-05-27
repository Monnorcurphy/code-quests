#!/bin/bash
# checks/test-ratio.sh — Enforce minimum test file ratio
# Usage: ./checks/test-ratio.sh [search-path]
#
# Counts source files vs test files and enforces a minimum ratio.
# If a project has > 10 source files, it needs at least 1 test file
# per 3 source files (ratio >= 0.3).
#
# Exit 0 if ratio is acceptable or project is small, 1 if too few tests

SEARCH_PATH="${1:-.}"

# ── Count source files (excluding tests) ──
SOURCE_COUNT=$(find "${SEARCH_PATH}" -type f \
    \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.rs' -o -name '*.py' \) \
    -not -path '*/.git/*' -not -path '*/node_modules/*' -not -path '*/dist/*' \
    -not -path '*/build/*' -not -path '*/target/*' -not -path '*/venv/*' \
    -not -path '*/__pycache__/*' -not -path '*/projects/*' -not -path '*/ui/*' \
    -not -path '*/adversarial-tests/*' 2>/dev/null \
    | grep -v '\.test\.\|\.spec\.\|_test\.\|tests/\|__tests__/\|test_' \
    | wc -l | tr -d ' ')

# ── Count test files ──
TEST_COUNT=$(find "${SEARCH_PATH}" -type f \
    \( -name '*.test.*' -o -name '*.spec.*' -o -name '*_test.*' -o -name 'test_*' \) \
    \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.rs' -o -name '*.py' \) \
    -not -path '*/.git/*' -not -path '*/node_modules/*' -not -path '*/dist/*' \
    -not -path '*/build/*' -not -path '*/target/*' -not -path '*/venv/*' \
    -not -path '*/__pycache__/*' -not -path '*/projects/*' -not -path '*/ui/*' \
    -not -path '*/adversarial-tests/*' 2>/dev/null \
    | wc -l | tr -d ' ')

# Also count files inside tests/ or __tests__/ directories
TEST_DIR_COUNT=$(find "${SEARCH_PATH}" -type f \
    \( -path '*/tests/*' -o -path '*/__tests__/*' \) \
    \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.rs' -o -name '*.py' \) \
    -not -path '*/.git/*' -not -path '*/node_modules/*' -not -path '*/dist/*' \
    -not -path '*/build/*' -not -path '*/target/*' -not -path '*/venv/*' \
    -not -path '*/__pycache__/*' -not -path '*/projects/*' -not -path '*/ui/*' \
    -not -path '*/adversarial-tests/*' 2>/dev/null \
    | wc -l | tr -d ' ')

TOTAL_TESTS=$((TEST_COUNT + TEST_DIR_COUNT))

echo "Source files: ${SOURCE_COUNT}"
echo "Test files:   ${TOTAL_TESTS}"

# ── Skip check for small projects ──
if [ "$SOURCE_COUNT" -le 10 ]; then
    echo "✅ Project has ${SOURCE_COUNT} source files (≤10) — test ratio check skipped"
    exit 0
fi

# ── Calculate ratio ──
if [ "$SOURCE_COUNT" -gt 0 ]; then
    # Use awk for floating point division
    RATIO=$(awk "BEGIN { printf \"%.2f\", ${TOTAL_TESTS} / ${SOURCE_COUNT} }")
    PERCENT=$(awk "BEGIN { printf \"%.0f\", (${TOTAL_TESTS} / ${SOURCE_COUNT}) * 100 }")

    echo "Test ratio:   ${RATIO} (${PERCENT}%)"

    # Check if ratio is below threshold (0.3)
    BELOW=$(awk "BEGIN { print (${TOTAL_TESTS} / ${SOURCE_COUNT} < 0.3) ? 1 : 0 }")

    if [ "$BELOW" -eq 1 ]; then
        NEEDED=$(awk "BEGIN { printf \"%.0f\", (${SOURCE_COUNT} * 0.3) - ${TOTAL_TESTS} }")
        echo ""
        echo "❌ Test ratio ${RATIO} is below minimum 0.30 (1 test per 3 source files)"
        echo "   Need approximately ${NEEDED} more test file(s)"
        echo ""
        echo "Fix: add test files for untested modules. Focus on:"
        echo "  - Business logic and data transformations"
        echo "  - API route handlers"
        echo "  - Complex UI components"
        exit 1
    fi
fi

echo "✅ Test ratio is healthy"
exit 0

#!/bin/bash
# checks/input-maxlength.sh — Detect unbounded text inputs
# Usage: ./checks/input-maxlength.sh [search-path]
#
# Text inputs without maxLength allow users to submit unbounded data,
# which can cause database overflows, memory issues, and DoS vectors.
#
# Checks <input> (text-like types) and <textarea> for maxLength/maxlength.
# Skips: number, checkbox, radio, hidden, submit, button, file, date, range, color.
#
# Exit 0 if clean, 1 if violations found

SEARCH_PATH="${1:-.}"
FOUND=0

EXCLUDES="--exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=dev-dist --exclude-dir=build --exclude-dir=.vite --exclude-dir=target --exclude-dir=.next --exclude-dir=out --exclude-dir=venv --exclude-dir=__pycache__ --exclude-dir=projects --exclude-dir=ui --exclude-dir=adversarial-tests"
FILE_EXCLUDES="--exclude=*.min.js --exclude=*.bundle.js --exclude=*bundle.js"

# Also exclude .claude/worktrees and test fixtures
if [ -d "${SEARCH_PATH}/.claude/worktrees" ]; then
    EXCLUDES="${EXCLUDES} --exclude-dir=worktrees"
fi

# ── textarea without maxLength ──
TEXTAREA_HITS=$(grep -rn ${EXCLUDES} -E '<textarea' "${SEARCH_PATH}" \
    --include="*.tsx" --include="*.jsx" --include="*.html" --include="*.vue" --include="*.svelte" ${FILE_EXCLUDES} \
    2>/dev/null | grep -vi 'maxlength' \
    | grep -v '\.test\.' | grep -v '\.spec\.' \
    | grep -v '/fixtures/' | grep -v '/test-fixtures/')

if [ -n "$TEXTAREA_HITS" ]; then
    COUNT=$(echo "$TEXTAREA_HITS" | wc -l | tr -d ' ')
    echo "❌ Found ${COUNT} <textarea> without maxLength:"
    echo "$TEXTAREA_HITS" | head -10
    FOUND=1
fi

# ── input without maxLength — only text-like types ──
# First find all <input lines, then filter to text-like types, then exclude maxlength
# Text-like: type="text", type="email", type="url", type="search", type="tel", type="password", or no type attribute
NON_TEXT_TYPES='type="number"\|type="checkbox"\|type="radio"\|type="hidden"\|type="submit"\|type="button"\|type="file"\|type="date"\|type="datetime"\|type="range"\|type="color"\|type="image"\|type="reset"'

INPUT_HITS=$(grep -rn ${EXCLUDES} -E '<input' "${SEARCH_PATH}" \
    --include="*.tsx" --include="*.jsx" --include="*.html" --include="*.vue" --include="*.svelte" ${FILE_EXCLUDES} \
    2>/dev/null | grep -vi 'maxlength' \
    | grep -v "${NON_TEXT_TYPES}" \
    | grep -v '\.test\.' | grep -v '\.spec\.' \
    | grep -v '/fixtures/' | grep -v '/test-fixtures/')

if [ -n "$INPUT_HITS" ]; then
    COUNT=$(echo "$INPUT_HITS" | wc -l | tr -d ' ')
    echo "❌ Found ${COUNT} text-like <input> without maxLength:"
    echo "$INPUT_HITS" | head -15
    FOUND=1
fi

if [ "$FOUND" -eq 0 ]; then
    echo "✅ All text inputs have maxLength bounds"
fi

if [ "$FOUND" -eq 1 ]; then
    echo ""
    echo "Fix: add maxLength={255} (or appropriate limit) to all text inputs and textareas"
fi

exit ${FOUND}

#!/bin/bash
# checks/contrast-classes.sh — Ban low-contrast Tailwind CSS classes
# Usage: ./checks/contrast-classes.sh [search-path]
#
# WCAG AA requires 4.5:1 contrast for normal text, 3:1 for large text.
# These Tailwind classes consistently fail on both light and dark backgrounds:
#   text-{gray,neutral,slate,zinc}-{100,200,300,400}
#   border-gray-{100,200,300}
#   placeholder-gray-{100,200,300,400}
#
# This was the single largest bug category in production (25+ bugs).
# A grep-based gate catches them at zero context cost.
#
# Exit 0 if clean, 1 if violations found

SEARCH_PATH="${1:-.}"

EXCLUDES="--exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=dev-dist --exclude-dir=build --exclude-dir=.vite --exclude-dir=target --exclude-dir=.next --exclude-dir=out --exclude-dir=projects --exclude-dir=venv --exclude-dir=__pycache__ --exclude-dir=ui --exclude-dir=adversarial-tests"
FILE_EXCLUDES="--exclude=*.min.js --exclude=*.bundle.js --exclude=*bundle.js"

# Also exclude .claude/worktrees if present
if [ -d "${SEARCH_PATH}/.claude/worktrees" ]; then
    EXCLUDES="${EXCLUDES} --exclude-dir=worktrees"
fi

PATTERN='text-gray-[1234]00\|text-neutral-[1234]00\|text-slate-[1234]00\|text-zinc-[1234]00\|border-gray-[123]00\|placeholder-gray-[1234]00\|placeholder:text-gray-[1234]00'

MATCHES=$(grep -rn ${EXCLUDES} "${PATTERN}" "${SEARCH_PATH}" \
    --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
    --include="*.html" --include="*.vue" --include="*.svelte" ${FILE_EXCLUDES} \
    2>/dev/null | grep -v '\.test\.' | grep -v '\.spec\.' | grep -v node_modules)

if [ -n "$MATCHES" ]; then
    COUNT=$(echo "$MATCHES" | wc -l | tr -d ' ')
    echo "❌ Found ${COUNT} low-contrast class usage(s) — WCAG 4.5:1 violation:"
    echo "$MATCHES" | head -20
    echo ""
    echo "Fix: use text-gray-500 minimum for secondary text, text-gray-600+ for body text"
    echo "     use border-gray-500+ for interactive borders"
    exit 1
fi

exit 0

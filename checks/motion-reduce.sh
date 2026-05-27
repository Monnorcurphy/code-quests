#!/bin/bash
# checks/motion-reduce.sh — Detect animations without reduced-motion guards
# Usage: ./checks/motion-reduce.sh [search-path]
#
# WCAG 2.3.3 requires respecting prefers-reduced-motion.
# Tailwind animate-* classes must be paired with motion-reduce: or motion-safe:.
# CSS transition/animation properties need a prefers-reduced-motion media query.
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

# ── Tailwind: animate-* without motion-reduce: or motion-safe: ──
ANIMATE_HITS=$(grep -rn ${EXCLUDES} -E 'animate-(spin|ping|pulse|bounce|fade|slide|zoom)' "${SEARCH_PATH}" \
    --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
    --include="*.html" --include="*.vue" --include="*.svelte" ${FILE_EXCLUDES} \
    2>/dev/null | grep -v 'motion-reduce\|motion-safe\|prefers-reduced-motion' \
    | grep -v '\.test\.' | grep -v '\.spec\.' | grep -v '\.config\.')

if [ -n "$ANIMATE_HITS" ]; then
    COUNT=$(echo "$ANIMATE_HITS" | wc -l | tr -d ' ')
    echo "❌ Found ${COUNT} Tailwind animate-* class(es) without motion-reduce/motion-safe guard:"
    echo "$ANIMATE_HITS" | head -15
    echo ""
    echo "Fix: add motion-reduce:animate-none or wrap with motion-safe:animate-*"
    FOUND=1
fi

# ── CSS: transition/animation without prefers-reduced-motion ──
# Find CSS/SCSS files with transition or animation properties
CSS_FILES=$(grep -rln ${EXCLUDES} -E 'transition:|animation:' "${SEARCH_PATH}" \
    --include="*.css" --include="*.scss" --include="*.less" ${FILE_EXCLUDES} \
    2>/dev/null | grep -v '\.test\.' | grep -v '\.spec\.')

if [ -n "$CSS_FILES" ]; then
    UNGUARDED=""
    while IFS= read -r file; do
        # Check if the file has prefers-reduced-motion anywhere
        if ! grep -q 'prefers-reduced-motion' "$file" 2>/dev/null; then
            HAS_ANIM=$(grep -n -E 'transition:|animation:' "$file" 2>/dev/null | head -3)
            if [ -n "$HAS_ANIM" ]; then
                UNGUARDED="${UNGUARDED}${file}:
${HAS_ANIM}
"
            fi
        fi
    done <<< "$CSS_FILES"

    if [ -n "$UNGUARDED" ]; then
        COUNT=$(echo "$CSS_FILES" | while IFS= read -r f; do
            grep -q 'prefers-reduced-motion' "$f" 2>/dev/null || echo "$f"
        done | wc -l | tr -d ' ')
        echo "⚠️  Found ${COUNT} CSS file(s) with transitions/animations but no prefers-reduced-motion query:"
        echo "$UNGUARDED" | head -20
        echo ""
        echo "Fix: add @media (prefers-reduced-motion: reduce) { ... } to disable animations"
        FOUND=1
    fi
fi

if [ "$FOUND" -eq 0 ]; then
    echo "✅ All animations have reduced-motion guards"
fi

exit ${FOUND}

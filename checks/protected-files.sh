#!/bin/bash
# checks/protected-files.sh — Verify factory infrastructure files exist
# Usage: ./checks/protected-files.sh [search-path]
#
# Ensures critical project files haven't been accidentally deleted:
# 1. CLAUDE.md — project instructions
# 2. .gitignore — prevents committing secrets/build artifacts
# 3. factory/ directory — if it previously existed (check git log)
# 4. scripts/ directory — if it previously existed (check git log)
#
# Exit 0 if clean, 1 if protected files are missing

SEARCH_PATH="${1:-.}"
FOUND=0

# ── Required files ──
# CLAUDE.md or FACTORY-KNOWLEDGE.md (dark-factory uses the latter)
if [ ! -e "${SEARCH_PATH}/CLAUDE.md" ] && [ ! -e "${SEARCH_PATH}/FACTORY-KNOWLEDGE.md" ]; then
    echo "❌ Protected file missing: CLAUDE.md (or FACTORY-KNOWLEDGE.md)"
    FOUND=1
fi

if [ ! -e "${SEARCH_PATH}/.gitignore" ]; then
    echo "❌ Protected file missing: .gitignore"
    FOUND=1
fi

# ── Directories that must not be deleted if they existed before ──
# Only check if we're in a git repo
if git -C "$SEARCH_PATH" rev-parse --git-dir >/dev/null 2>&1; then
    PROTECTED_DIRS="factory scripts"

    for dir in $PROTECTED_DIRS; do
        # Check if directory ever existed in git history
        EXISTED=$(git -C "$SEARCH_PATH" log --all --diff-filter=A --name-only --pretty=format: -- "${dir}/" 2>/dev/null | head -1)

        if [ -n "$EXISTED" ] && [ ! -d "${SEARCH_PATH}/${dir}" ]; then
            echo "❌ Protected directory was deleted: ${dir}/"
            echo "   This directory previously existed in git history."
            FOUND=1
        fi
    done

    # ── Check if any protected files were deleted in the latest commit ──
    DELETED_PROTECTED=$(git -C "$SEARCH_PATH" diff --name-only --diff-filter=D HEAD~1 HEAD 2>/dev/null \
        | grep -E '^(CLAUDE\.md|\.gitignore|factory/|scripts/)' )

    if [ -n "$DELETED_PROTECTED" ]; then
        echo "⚠️  Protected files deleted in latest commit:"
        echo "$DELETED_PROTECTED"
        FOUND=1
    fi
fi

if [ "$FOUND" -eq 0 ]; then
    echo "✅ All protected files and directories are present"
fi

exit ${FOUND}

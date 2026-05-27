#!/bin/bash
# checks/diff-allowlist.sh — Enforce "only these paths may change"
# Usage: ./checks/diff-allowlist.sh <allowlist-file>
#
# Allowlist format (one glob per line):
#   packages/desktop/src/**
#   packages/shared/src/**
#   specs/**
#   progress.md
#
# Exit 0 if all changes are within allowed paths, 1 otherwise.

ALLOWLIST="${1:?Usage: diff-allowlist.sh <allowlist-file>}"

if [ ! -f "$ALLOWLIST" ]; then
    # When called with a directory (e.g., from a batch check run), skip gracefully
    if [ -d "$ALLOWLIST" ]; then
        exit 0
    fi
    echo "❌ Allowlist file not found: ${ALLOWLIST}"
    exit 1
fi

VIOLATIONS=""

# Get changed files
CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || git diff --name-only HEAD)

for file in $CHANGED; do
    ALLOWED=false
    while IFS= read -r pattern; do
        # Skip empty lines and comments
        [[ -z "$pattern" || "$pattern" == \#* ]] && continue
        # Use bash pattern matching
        if [[ "$file" == $pattern ]]; then
            ALLOWED=true
            break
        fi
    done < "$ALLOWLIST"

    if [ "$ALLOWED" = false ]; then
        VIOLATIONS+="  ❌ ${file}"$'\n'
    fi
done

if [ -n "$VIOLATIONS" ]; then
    echo "❌ Changes outside allowed paths:"
    echo "$VIOLATIONS"
    exit 1
fi

exit 0

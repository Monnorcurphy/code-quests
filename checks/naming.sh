#!/bin/bash
# checks/naming.sh — Enforce file naming conventions
# Usage: ./checks/naming.sh [convention] [search-path]
#
# Conventions:
#   kebab-case  (default) — my-component.ts
#   snake_case            — my_component.py
#   camelCase             — myComponent.ts
#
# Checks only files changed in the current branch vs main.

CONVENTION="${1:-kebab-case}"
SEARCH_PATH="${2:-.}"

VIOLATIONS=""

# Get changed files
CHANGED=$(git diff --name-only main...HEAD 2>/dev/null || git diff --name-only HEAD~1 HEAD 2>/dev/null)

for file in $CHANGED; do
    BASENAME=$(basename "$file" | sed 's/\.[^.]*$//')  # strip extension

    case "${CONVENTION}" in
        kebab-case)
            if echo "$BASENAME" | grep -qE '[A-Z_]'; then
                VIOLATIONS+="  ❌ ${file} (expected kebab-case)"$'\n'
            fi
            ;;
        snake_case)
            if echo "$BASENAME" | grep -qE '[A-Z-]'; then
                VIOLATIONS+="  ❌ ${file} (expected snake_case)"$'\n'
            fi
            ;;
        camelCase)
            if echo "$BASENAME" | grep -qE '[-_]'; then
                VIOLATIONS+="  ❌ ${file} (expected camelCase)"$'\n'
            fi
            ;;
    esac
done

if [ -n "$VIOLATIONS" ]; then
    echo "⚠️  Naming violations (${CONVENTION}):"
    echo "$VIOLATIONS"
    exit 1
fi

exit 0

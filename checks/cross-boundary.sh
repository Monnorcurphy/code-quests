#!/bin/bash
# checks/cross-boundary.sh — Detect potential cross-boundary enum mismatches
# Usage: ./checks/cross-boundary.sh [search-path]
#
# Values flowing between systems (UI→DB, API→service, config→runtime) must
# be validated against the receiving system's constraints. Mocked boundaries
# hide these mismatches — tests pass but the app crashes at runtime.
#
# This check extracts CHECK constraints from SQL migrations and surfaces
# them for review. It's heuristic, not perfect, but catches the most common
# class of cross-boundary bugs.
#
# Exit 0 always (this is a WARN check — reviewer handles mismatches)

SEARCH_PATH="${1:-.}"
FOUND_ISSUES=0

# Find SQL migrations
SQL_FILES=$(find "${SEARCH_PATH}" -name "*.sql" -not -path "*/node_modules/*" -not -path "*/target/*" 2>/dev/null)

if [ -z "${SQL_FILES}" ]; then
    exit 0
fi

# Extract CHECK constraints with IN clauses
for sql in ${SQL_FILES}; do
    # Match patterns like: column_name IN ('value1', 'value2', 'value3')
    # or CHECK(column IN ('value1', 'value2'))
    CHECKS=$(grep -oE "[a-z_]+ IN \(['\"][^)]+\)" "${sql}" 2>/dev/null)

    if [ -n "${CHECKS}" ]; then
        echo "── Cross-boundary check: ${sql}"
        echo "${CHECKS}" | while IFS= read -r constraint; do
            COLUMN=$(echo "${constraint}" | sed 's/ IN .*//')
            VALUES=$(echo "${constraint}" | grep -oE "'[^']+'" | tr -d "'" | sort)
            echo "   Column: ${COLUMN}"
            echo "   Allowed: $(echo ${VALUES} | tr '\n' ', ')"
        done
        echo ""
    fi
done

# Note: Full validation requires checking frontend code against these constraints.
# The reviewer agent should compare these values against UI option lists, Zod schemas,
# and store defaults. This script surfaces the constraints for human/agent review.

exit 0

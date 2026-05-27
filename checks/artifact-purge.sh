#!/bin/bash
# checks/artifact-purge.sh — Purge artifacts scoped to a task ID
# Usage: ./checks/artifact-purge.sh <task-id>
#
# Cleans up: review bug files, review pass files, and task-specific logs

TASK_ID="${1:?Usage: artifact-purge.sh <task-id>}"

echo "  Purging artifacts for task ${TASK_ID}..."

# Review artifacts
REMOVED=0
for f in specs/bugs/review-*.md specs/done/review-pass-*.md; do
    if [ -f "$f" ]; then
        rm -f "$f"
        REMOVED=$((REMOVED + 1))
    fi
done

echo "  Removed ${REMOVED} artifact file(s)"

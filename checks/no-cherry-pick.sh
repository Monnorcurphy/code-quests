#!/bin/bash
# checks/no-cherry-pick.sh — Enforce task isolation (HARD gate)
# Usage: ./checks/no-cherry-pick.sh <task-id> [parent-branch]
#
# Fails if:
#   1. Any commit on this branch contains "cherry-picked from" metadata
#   2. Any commit message references a different task ID than the current one
#
# The parent-branch argument (default: main) controls which commits are checked.
# Only commits since the parent branch are inspected, so stacked task branches
# (e.g., task 1.2 on top of task 1.1) don't trigger false positives from
# inherited parent commits.
#
# Exit 0 if clean, 1 if violations found.

TASK_ID="${1:?Usage: no-cherry-pick.sh <task-id> [parent-branch]}"
PARENT_BRANCH="${2:-main}"

VIOLATIONS=""

# Get commits unique to this branch (not on parent)
COMMITS=$(git log "${PARENT_BRANCH}..HEAD" --oneline 2>/dev/null)
if [ -z "$COMMITS" ]; then
    # No commits ahead of parent — nothing to check
    exit 0
fi

# Check 1: Cherry-pick metadata in commit messages
CHERRY_PICKS=$(git log "${PARENT_BRANCH}..HEAD" --grep="cherry picked from" --oneline 2>/dev/null)
if [ -n "$CHERRY_PICKS" ]; then
    VIOLATIONS+="  Cherry-pick metadata found:"$'\n'
    while IFS= read -r line; do
        VIOLATIONS+="    ${line}"$'\n'
    done <<< "$CHERRY_PICKS"
fi

# Check 2: Commits referencing a different task ID
# Extract the phase.task pattern from TASK_ID (e.g., "1.1" from "1.1")
PHASE_NUM="${TASK_ID%%.*}"

# Look for "TASK X.Y" or "task-X.Y" references that don't match our task
WRONG_TASK=$(git log "${PARENT_BRANCH}..HEAD" --oneline 2>/dev/null | grep -iE "(task[- ]?${PHASE_NUM}\.[0-9]+)" | grep -iv "task[- ]?${TASK_ID}" | grep -iv "task[- ]?${TASK_ID}[^0-9]")
if [ -n "$WRONG_TASK" ]; then
    VIOLATIONS+="  Commits referencing different task IDs:"$'\n'
    while IFS= read -r line; do
        VIOLATIONS+="    ${line}"$'\n'
    done <<< "$WRONG_TASK"
fi

if [ -n "$VIOLATIONS" ]; then
    echo "❌ TASK ISOLATION VIOLATION on branch $(git branch --show-current):"
    echo "$VIOLATIONS"
    echo ""
    echo "  Do not cherry-pick between task branches."
    echo "  If work is on the wrong branch, file a blocker bug and rerun."
    exit 1
fi

exit 0

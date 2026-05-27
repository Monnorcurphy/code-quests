#!/bin/bash
# core/scripts/rename-tasks.sh — Batch rename spec files to 5-digit zero-padded IDs
# Usage: ./core/scripts/rename-tasks.sh [--apply]
#
# Default: dry-run mode (shows what would happen without executing)
#
# Renames:
#   task-3.1-foo.md  -> task-3.00001-foo.md
#   task-3.12-foo.md -> task-3.00012-foo.md
#   review-pass-task-3.1.md -> review-pass-task-3.00001.md
#
# Also updates TASK/task- references inside all spec .md files.
# Flags a/b/c-suffixed specs for manual consolidation (does NOT rename them).

set -uo pipefail

APPLY=""

for arg in "$@"; do
    case "$arg" in
        --apply) APPLY="yes" ;;
        --help|-h)
            echo "Usage: ./core/scripts/rename-tasks.sh [--apply]"
            echo "  Default: dry-run (shows renames without executing)"
            echo "  --apply: execute renames and update references"
            exit 0
            ;;
    esac
done

MODE=$([ -n "${APPLY}" ] && echo "APPLY" || echo "DRY RUN")

echo ""
echo "=========================================="
echo "  RENAME TASKS — 5-digit zero-padded IDs"
echo "=========================================="
echo ""
echo "  Mode: ${MODE}"
echo ""

# ── Detect a/b/c specs ──
ABC_COUNT=0
echo "  Checking for a/b/c-suffixed specs..."

for SPEC_DIR in specs/phase-*/; do
    [ -d "${SPEC_DIR}" ] || continue
    for f in "${SPEC_DIR}"task-*.md; do
        [ -f "$f" ] || continue
        BASENAME=$(basename "$f")
        if echo "$BASENAME" | grep -qE '^task-[0-9]+\.[0-9]+[a-z]-'; then
            if [ ${ABC_COUNT} -eq 0 ]; then
                echo ""
                echo "  WARNING: a/b/c-suffixed specs found (manual consolidation needed):"
            fi
            echo "    ${f}"
            ABC_COUNT=$((ABC_COUNT + 1))
        fi
    done
done

if [ ${ABC_COUNT} -gt 0 ]; then
    echo ""
    echo "  ${ABC_COUNT} file(s) with alpha suffixes need manual decisions."
    echo "  Consolidate into parent tasks or assign new sequential numbers,"
    echo "  then re-run this script."
    echo ""
fi

# ── Collect rename operations ──
echo "  Scanning spec files..."
echo ""

RENAMES=0
RENAME_LIST=$(mktemp)
trap "rm -f ${RENAME_LIST}" EXIT

# Process specs/phase-*/ task files
for SPEC_DIR in specs/phase-*/; do
    [ -d "${SPEC_DIR}" ] || continue
    for f in "${SPEC_DIR}"task-*.md; do
        [ -f "$f" ] || continue
        BASENAME=$(basename "$f")

        # Skip a/b/c files
        if echo "$BASENAME" | grep -qE '^task-[0-9]+\.[0-9]+[a-z]'; then
            continue
        fi

        # Extract phase number and task number
        # Pattern: task-P.T-description.md or task-P.T.md
        PHASE_NUM=$(echo "$BASENAME" | sed -E 's/^task-([0-9]+)\..*/\1/')
        TASK_NUM=$(echo "$BASENAME" | sed -E 's/^task-[0-9]+\.([0-9]+).*/\1/')
        REST=$(echo "$BASENAME" | sed -E 's/^task-[0-9]+\.[0-9]+(.*)/\1/')

        # Skip if already zero-padded (5+ digits)
        if [ ${#TASK_NUM} -ge 5 ]; then
            continue
        fi

        PADDED=$(printf "%05d" "$TASK_NUM")
        NEW_NAME="task-${PHASE_NUM}.${PADDED}${REST}"
        NEW_PATH="${SPEC_DIR}${NEW_NAME}"

        echo "  ${f} -> ${NEW_PATH}"
        echo "${f} ${NEW_PATH}" >> "${RENAME_LIST}"
        RENAMES=$((RENAMES + 1))
    done
done

# Process specs/done/ review-pass files
for f in specs/done/review-pass-task-*.md; do
    [ -f "$f" ] || continue
    BASENAME=$(basename "$f")

    # Pattern: review-pass-task-P.T.md
    if echo "$BASENAME" | grep -qE '^review-pass-task-[0-9]+\.[0-9]+\.md$'; then
        PHASE_NUM=$(echo "$BASENAME" | sed -E 's/^review-pass-task-([0-9]+)\..*/\1/')
        TASK_NUM=$(echo "$BASENAME" | sed -E 's/^review-pass-task-[0-9]+\.([0-9]+)\.md$/\1/')

        if [ ${#TASK_NUM} -ge 5 ]; then
            continue
        fi

        PADDED=$(printf "%05d" "$TASK_NUM")
        NEW_NAME="review-pass-task-${PHASE_NUM}.${PADDED}.md"
        NEW_PATH="specs/done/${NEW_NAME}"

        echo "  ${f} -> ${NEW_PATH}"
        echo "${f} ${NEW_PATH}" >> "${RENAME_LIST}"
        RENAMES=$((RENAMES + 1))
    fi
done

echo ""
echo "  Total renames: ${RENAMES}"

if [ ${RENAMES} -eq 0 ] && [ ${ABC_COUNT} -eq 0 ]; then
    echo "  Nothing to do — all files already use zero-padded IDs."
    exit 0
fi

if [ -z "${APPLY}" ]; then
    echo ""
    echo "  This was a dry run. To execute:"
    echo "    ./core/scripts/rename-tasks.sh --apply"
    exit 0
fi

# ── Apply renames ──
echo ""
echo "  Applying renames..."

while IFS=' ' read -r OLD NEW; do
    [ -z "$OLD" ] && continue
    mv "$OLD" "$NEW"
    echo "  OK $(basename "$OLD") -> $(basename "$NEW")"
done < "${RENAME_LIST}"

# ── Update internal references ──
echo ""
echo "  Updating TASK and task- references in spec files..."

# Use perl to update references: TASK P.N -> TASK P.NNNNN, task-P.N -> task-P.NNNNN
# Only matches 1-4 digit task numbers (skips already-padded 5+ digit numbers)
find specs/ -name "*.md" -exec perl -pi -e '
    s/TASK (\d+)\.(\d{1,4})(?=\D|$)/"TASK " . $1 . "." . sprintf("%05d", $2)/ge;
    s/task-(\d+)\.(\d{1,4})(?=\D|$)/"task-" . $1 . "." . sprintf("%05d", $2)/ge;
' {} +

# Also update progress.md if it exists
if [ -f "progress.md" ]; then
    perl -pi -e '
        s/TASK (\d+)\.(\d{1,4})(?=\D|$)/"TASK " . $1 . "." . sprintf("%05d", $2)/ge;
        s/task-(\d+)\.(\d{1,4})(?=\D|$)/"task-" . $1 . "." . sprintf("%05d", $2)/ge;
    ' progress.md
fi

echo "  OK References updated"

echo ""
echo "=========================================="
echo "  RENAME COMPLETE"
echo "=========================================="
echo ""
echo "  Files renamed: ${RENAMES}"
if [ ${ABC_COUNT} -gt 0 ]; then
    echo "  WARNING: ${ABC_COUNT} a/b/c files still need manual consolidation"
fi
echo ""
echo "  Next steps:"
echo "    1. Review: git diff --stat"
echo "    2. Handle a/b/c files manually (if any)"
echo "    3. Commit: git add specs/ && git commit -m 'chore: rename tasks to 5-digit zero-padded IDs'"
echo ""

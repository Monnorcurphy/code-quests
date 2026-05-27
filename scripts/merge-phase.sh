#!/bin/bash
# core/scripts/merge-phase.sh — Merge completed task branches into an attempt branch
# Usage: ./core/scripts/merge-phase.sh <phase> --attempt=N [--dry-run] [--delete]
#
# After a phase completes via phase.sh, this merges all task branches into
# the attempt branch so the next phase can build on top.
#
# Supports codename branches (feature/alpaca) and legacy numeric (feature/task-1.00001).
#
# Flags:
#   --attempt=N  (required) Target attempt branch
#   --dry-run    List branches and verify, but don't merge
#   --delete     Delete task branches (local + remote) after successful merge

set -uo pipefail

# ── Source shared helpers ──
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

PHASE=""
ATTEMPT=""
DRY_RUN=""
DELETE_BRANCHES=""

for arg in "$@"; do
    case "$arg" in
        --attempt=*) ATTEMPT="${arg#--attempt=}" ;;
        --dry-run) DRY_RUN="yes" ;;
        --delete) DELETE_BRANCHES="yes" ;;
        *) PHASE="$arg" ;;
    esac
done

if [ -z "$PHASE" ] || [ -z "$ATTEMPT" ]; then
    echo "Usage: ./core/scripts/merge-phase.sh <phase> --attempt=N [--dry-run] [--delete]"
    exit 1
fi

ATTEMPT_BRANCH="attempt-${ATTEMPT}"

# ── Discover tasks ──
TASKS=""
if has_sequence "${PHASE}"; then
    TASKS=$(phase_tasks "${PHASE}")
elif [ -d "specs/phase-${PHASE}" ]; then
    TASKS=$(ls "specs/phase-${PHASE}"/task-${PHASE}.*.md 2>/dev/null | sed -E "s|.*task-([0-9]+\.[0-9]+).*|\1|" | sort)
else
    SPEC_FILE=$(ls specs/features/phase-${PHASE}-*.md 2>/dev/null | head -1)
    if [ -n "${SPEC_FILE}" ]; then
        TASKS=$(grep -oE "TASK ${PHASE}\.[0-9]+" "${SPEC_FILE}" | sed 's/TASK //' | sort -u)
    fi
fi

if [ -z "${TASKS}" ]; then
    echo "  No tasks found for phase ${PHASE}"
    exit 1
fi

TOTAL=$(echo "$TASKS" | wc -l | tr -d ' ')

# ── Verify attempt branch exists ──
if ! git rev-parse --verify "${ATTEMPT_BRANCH}" >/dev/null 2>&1; then
    echo "  Attempt branch '${ATTEMPT_BRANCH}' does not exist."
    echo "   Create it: git checkout -b ${ATTEMPT_BRANCH} main && git push -u origin ${ATTEMPT_BRANCH}"
    exit 1
fi

# ── Verify all task branches exist ──
MISSING=""
TASK_BRANCHES=""
for TASK_ID in $TASKS; do
    if is_codename "${TASK_ID}"; then
        BRANCH=$(task_branch "${TASK_ID}")
    else
        BRANCH="feature/task-${TASK_ID}"
    fi
    if git rev-parse --verify "${BRANCH}" >/dev/null 2>&1; then
        TASK_BRANCHES="${TASK_BRANCHES} ${BRANCH}"
    else
        MISSING="${MISSING} ${TASK_ID}"
    fi
done

if [ -n "${MISSING}" ]; then
    echo "  Missing task branches:${MISSING}"
    echo "   These tasks need to be completed first."
    exit 1
fi

echo ""
echo "======================================================="
echo "  MERGE PHASE ${PHASE} -> ${ATTEMPT_BRANCH}"
echo "======================================================="
echo ""
echo "  Tasks:  ${TOTAL}"
echo "  Target: ${ATTEMPT_BRANCH}"
echo "  Mode:   $([ -n "${DRY_RUN}" ] && echo 'DRY RUN' || echo 'LIVE')"
echo ""

for TASK_ID in $TASKS; do
    if is_codename "${TASK_ID}"; then
        BRANCH=$(task_branch "${TASK_ID}")
    else
        BRANCH="feature/task-${TASK_ID}"
    fi
    COMMITS=$(git log --oneline "${ATTEMPT_BRANCH}..${BRANCH}" 2>/dev/null | wc -l | tr -d ' ')
    echo "  ${BRANCH} (${COMMITS} commits)"
done

if [ -n "${DRY_RUN}" ]; then
    echo ""
    echo "  Would merge ${TOTAL} task branches into ${ATTEMPT_BRANCH}"

    LAST_ID=$(echo "$TASKS" | tail -1)
    if is_codename "${LAST_ID}"; then
        LAST_BRANCH=$(task_branch "${LAST_ID}")
    else
        LAST_BRANCH="feature/task-${LAST_ID}"
    fi
    if git show "${LAST_BRANCH}:specs/done/phase-${PHASE}-complete.md" >/dev/null 2>&1; then
        echo "  Phase ${PHASE} completion marker found on ${LAST_BRANCH}"
    else
        echo "  Phase ${PHASE} completion marker NOT found (run phase.sh first)"
    fi

    echo ""
    exit 0
fi

# ── Checkout attempt branch and merge ──
ORIGINAL_BRANCH=$(git branch --show-current)
git checkout "${ATTEMPT_BRANCH}" || { echo "  Failed to checkout ${ATTEMPT_BRANCH}"; exit 1; }

MERGED=0
for TASK_ID in $TASKS; do
    if is_codename "${TASK_ID}"; then
        BRANCH=$(task_branch "${TASK_ID}")
    else
        BRANCH="feature/task-${TASK_ID}"
    fi
    echo ""
    echo "  Merging ${BRANCH}..."

    if git merge --no-ff "${BRANCH}" -m "merge: task ${TASK_ID} into ${ATTEMPT_BRANCH}"; then
        MERGED=$((MERGED + 1))
        echo "  ${BRANCH} merged"
    else
        echo ""
        echo "  Merge conflict on ${BRANCH}"
        echo "  Aborting merge..."
        git merge --abort
        echo ""
        echo "  Fix the conflict manually:"
        echo "    git checkout ${ATTEMPT_BRANCH}"
        echo "    git merge ${BRANCH}"
        echo "    # resolve conflicts"
        echo "    git commit"
        echo "    # then re-run: ./core/scripts/merge-phase.sh ${PHASE} --attempt=${ATTEMPT}"
        exit 1
    fi
done

# ── Verify completion marker ──
if [ -f "specs/done/phase-${PHASE}-complete.md" ]; then
    echo ""
    echo "  Phase ${PHASE} completion marker present"
else
    echo ""
    echo "  Phase ${PHASE} completion marker missing (phase.sh may not have finished cleanly)"
fi

# ── Push attempt branch ──
echo ""
echo "  Pushing ${ATTEMPT_BRANCH}..."
git push origin "${ATTEMPT_BRANCH}" || git push -u origin "${ATTEMPT_BRANCH}"

# ── Delete task branches if requested ──
if [ -n "${DELETE_BRANCHES}" ]; then
    echo ""
    echo "  Cleaning up task branches..."
    for TASK_ID in $TASKS; do
        if is_codename "${TASK_ID}"; then
            BRANCH=$(task_branch "${TASK_ID}")
        else
            BRANCH="feature/task-${TASK_ID}"
        fi
        git branch -d "${BRANCH}" 2>/dev/null && echo "  Deleted local: ${BRANCH}"
        git push origin --delete "${BRANCH}" 2>/dev/null && echo "  Deleted remote: ${BRANCH}"
    done
fi

echo ""
echo "======================================================="
echo "  PHASE ${PHASE} MERGED INTO ${ATTEMPT_BRANCH}"
echo "======================================================="
echo ""
echo "  Merged: ${MERGED}/${TOTAL} task branches"
echo "  Branch: ${ATTEMPT_BRANCH}"
echo ""
echo "  Next phase: ./core/scripts/phase.sh $((PHASE + 1)) --attempt=${ATTEMPT}"
echo ""

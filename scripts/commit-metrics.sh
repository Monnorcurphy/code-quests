#!/bin/bash
# core/scripts/commit-metrics.sh — Commit metrics to a dedicated branch via git worktree
#
# Usage:
#   ./core/scripts/commit-metrics.sh --scope=task --id=1.1 --attempt=1
#   ./core/scripts/commit-metrics.sh --scope=phase --id=2 --attempt=1
#   ./core/scripts/commit-metrics.sh --scope=project --attempt=1
#
# Commits metrics to branch `metrics/attempt-{N}` (or `metrics/default`)
# using a temporary git worktree. Zero disruption to the current feature branch.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
METRICS_DIR="${REPO_ROOT}/metrics"

# ── Argument parsing ──
SCOPE=""
ID=""
ATTEMPT=""

for arg in "$@"; do
    case "$arg" in
        --scope=*) SCOPE="${arg#*=}" ;;
        --id=*)    ID="${arg#*=}" ;;
        --attempt=*) ATTEMPT="${arg#*=}" ;;
        --help|-h)
            head -12 "$0" | tail -10
            exit 0
            ;;
    esac
done

if [ -z "${SCOPE}" ]; then
    echo "  Error: --scope=task|phase|project required"
    exit 1
fi

if [ "${SCOPE}" = "task" ] || [ "${SCOPE}" = "phase" ]; then
    if [ -z "${ID}" ]; then
        echo "  Error: --id=<id> required for scope=${SCOPE}"
        exit 1
    fi
fi

# ── Determine branch name ──
if [ -n "${ATTEMPT}" ]; then
    METRICS_BRANCH="metrics/attempt-${ATTEMPT}"
else
    METRICS_BRANCH="metrics/default"
fi

echo "  Collecting metrics (scope=${SCOPE}, id=${ID:-all})..."

# ── Step 1: Run collect-metrics if available ──
if [ -f "${SCRIPT_DIR}/collect-metrics.py" ]; then
    python3 "${SCRIPT_DIR}/collect-metrics.py" \
        --scope="${SCOPE}" \
        ${ID:+--id=${ID}} \
        ${ATTEMPT:+--attempt=${ATTEMPT}} || {
        echo "  Warning: collect-metrics.py failed, committing existing files only"
    }
fi

# ── Step 2: Check if metrics/ has anything to commit ──
if [ ! -d "${METRICS_DIR}" ] || [ -z "$(ls -A "${METRICS_DIR}" 2>/dev/null)" ]; then
    echo "  No metrics files found, skipping commit"
    exit 0
fi

# ── Step 3: Set up worktree ──
WORKTREE_DIR="${REPO_ROOT}/.metrics-worktree"

# Clean up any stale worktree
if [ -d "${WORKTREE_DIR}" ]; then
    git -C "${REPO_ROOT}" worktree remove --force "${WORKTREE_DIR}" 2>/dev/null || rm -rf "${WORKTREE_DIR}"
fi

# Check if the metrics branch exists (local or remote)
BRANCH_EXISTS=""
if git -C "${REPO_ROOT}" show-ref --verify --quiet "refs/heads/${METRICS_BRANCH}" 2>/dev/null; then
    BRANCH_EXISTS="local"
elif git -C "${REPO_ROOT}" show-ref --verify --quiet "refs/remotes/origin/${METRICS_BRANCH}" 2>/dev/null; then
    BRANCH_EXISTS="remote"
fi

if [ "${BRANCH_EXISTS}" = "local" ]; then
    git -C "${REPO_ROOT}" worktree add "${WORKTREE_DIR}" "${METRICS_BRANCH}" 2>/dev/null
elif [ "${BRANCH_EXISTS}" = "remote" ]; then
    git -C "${REPO_ROOT}" worktree add "${WORKTREE_DIR}" -b "${METRICS_BRANCH}" "origin/${METRICS_BRANCH}" 2>/dev/null
else
    # Brand new orphan branch
    git -C "${REPO_ROOT}" worktree add --detach "${WORKTREE_DIR}" 2>/dev/null
    (
        cd "${WORKTREE_DIR}"
        git checkout --orphan "${METRICS_BRANCH}"
        git rm -rf . 2>/dev/null || true
        git commit --allow-empty -m "metrics: initialize ${METRICS_BRANCH}"
    ) >/dev/null 2>&1
fi

if [ ! -d "${WORKTREE_DIR}" ]; then
    echo "  Error: failed to create worktree at ${WORKTREE_DIR}"
    exit 1
fi

# ── Step 4: Copy metrics files to worktree ──
WORKTREE_METRICS="${WORKTREE_DIR}/metrics"
mkdir -p "${WORKTREE_METRICS}"

case "${SCOPE}" in
    task)
        for pattern in "audit-task-${ID}"* "ralph-task-${ID}"* "snapshot-task-${ID}"*; do
            for f in "${METRICS_DIR}"/${pattern}; do
                [ -f "$f" ] && cp "$f" "${WORKTREE_METRICS}/"
            done
        done
        COMMIT_MSG="metrics: task ${ID}"
        ;;
    phase)
        PHASE_NUM="${ID}"
        for f in "${METRICS_DIR}"/audit-task-"${PHASE_NUM}".*; do
            [ -f "$f" ] && cp "$f" "${WORKTREE_METRICS}/"
        done
        for f in "${METRICS_DIR}"/ralph-task-"${PHASE_NUM}".*; do
            [ -f "$f" ] && cp "$f" "${WORKTREE_METRICS}/"
        done
        for f in "${METRICS_DIR}"/snapshot-task-"${PHASE_NUM}".*; do
            [ -f "$f" ] && cp "$f" "${WORKTREE_METRICS}/"
        done
        for f in "${METRICS_DIR}"/snapshot-phase-"${PHASE_NUM}"*; do
            [ -f "$f" ] && cp "$f" "${WORKTREE_METRICS}/"
        done
        for f in "${METRICS_DIR}"/progress-before-"${PHASE_NUM}".*; do
            [ -f "$f" ] && cp "$f" "${WORKTREE_METRICS}/"
        done
        COMMIT_MSG="metrics: phase ${ID} complete"
        ;;
    project)
        cp "${METRICS_DIR}"/* "${WORKTREE_METRICS}/" 2>/dev/null || true
        COMMIT_MSG="metrics: project run"
        ;;
esac

# ── Step 5: Commit in worktree ──
(
    cd "${WORKTREE_DIR}"
    git add metrics/ 2>/dev/null

    if git diff --cached --quiet 2>/dev/null; then
        echo "  No new metrics changes to commit"
    else
        FILE_COUNT=$(git diff --cached --name-only | wc -l | tr -d ' ')
        git commit -m "${COMMIT_MSG}" >/dev/null 2>&1
        echo "  Committed ${FILE_COUNT} file(s) to ${METRICS_BRANCH}: ${COMMIT_MSG}"
    fi
)

# ── Step 6: Clean up worktree ──
git -C "${REPO_ROOT}" worktree remove --force "${WORKTREE_DIR}" 2>/dev/null || rm -rf "${WORKTREE_DIR}"

echo "  Metrics commit complete (branch: ${METRICS_BRANCH})"

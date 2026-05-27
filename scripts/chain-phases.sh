#!/bin/bash
# chain-phases.sh — Run phases sequentially with auto-merge into main.
# Stops on first failure. Restores main-only files after each merge
# (works around the builder-deletion auto-restore not covering .claude/rules,
# founding-document.md, etc.).
#
# Usage: ./scripts/chain-phases.sh <start> <end>
# Example: ./scripts/chain-phases.sh 2 11
set -uo pipefail

START="${1:?usage: chain-phases.sh <start> <end>}"
END="${2:?usage: chain-phases.sh <start> <end>}"

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

source "$REPO_ROOT/scripts/lib.sh"

log() { printf '[chain %s] %s\n' "$(date +%H:%M:%S)" "$*"; }

for PHASE in $(seq "$START" "$END"); do
    PADDED=$(printf '%02d' "$PHASE")
    log "=== PHASE $PHASE ==="

    # Step 0: phase.sh uses `feature/<prev-phase-last-task>` as the parent for
    # the first task of this phase. If that branch lags behind main, the new
    # phase's tasks won't inherit anything committed to main after the
    # previous phase ended (factory fixes, restored files, etc.). Fast-forward
    # the prev-phase's last-task branch up to current main before phase.sh
    # runs.
    if [ "$PHASE" -gt 1 ]; then
        PREV_PHASE=$((PHASE - 1))
        PREV_LAST=$(last_task "$PREV_PHASE" 2>/dev/null || true)
        if [ -n "${PREV_LAST}" ]; then
            PREV_LAST_BRANCH="$(task_branch "$PREV_LAST")"
            if git rev-parse --verify "$PREV_LAST_BRANCH" >/dev/null 2>&1; then
                log "Fast-forwarding $PREV_LAST_BRANCH -> main so Phase $PHASE inherits fixes"
                git update-ref "refs/heads/$PREV_LAST_BRANCH" main
            fi
        fi
    fi

    # Step 1: generate spec if missing
    if [ ! -f "specs/phase-${PADDED}/sequence.md" ]; then
        log "Generating spec for phase $PHASE via slice-spec.sh..."
        if ! ./scripts/slice-spec.sh "$PHASE"; then
            log "FAIL: slice-spec.sh for phase $PHASE"
            exit 1
        fi
    fi

    # Step 2: validate sequence.md has parseable codenames
    if [ -z "$(phase_tasks "$PHASE")" ]; then
        log "FAIL: phase $PHASE sequence.md has no tasks after slicing"
        exit 1
    fi

    # Step 3: run the phase
    log "Running phase.sh $PHASE --yolo..."
    if ! ./scripts/phase.sh "$PHASE" --yolo; then
        log "FAIL: phase.sh $PHASE returned non-zero"
        exit 1
    fi

    # Step 4: locate last task's cumulative branch
    LAST_TASK=$(last_task "$PHASE")
    LAST_BRANCH="$(task_branch "$LAST_TASK")"
    if ! git rev-parse --verify "$LAST_BRANCH" >/dev/null 2>&1; then
        log "FAIL: last task branch $LAST_BRANCH does not exist"
        exit 1
    fi

    # Step 5: merge into main, then restore main-only files the merge deletes
    log "Merging $LAST_BRANCH into main..."
    PRE_MERGE=$(git rev-parse main)
    # Phase.sh's self-improvement pipeline can leave progress.md modified or
    # transient review artifacts deleted; that blocks `git checkout main`.
    # The work we care about is already committed on $LAST_BRANCH, so it's
    # safe to discard the dirty working tree before switching branches.
    git reset --hard HEAD 2>/dev/null || true
    git clean -fd specs/phase-* test-results packages/client/test-results 2>/dev/null || true
    git checkout main || exit 1
    if ! git merge --no-ff "$LAST_BRANCH" -m "Merge Phase ${PHASE}"; then
        log "FAIL: merge $LAST_BRANCH into main"
        exit 1
    fi

    # Restore files that existed on pre-merge main but were deleted by the merge
    TO_RESTORE="$(mktemp)"
    comm -23 \
        <(git ls-tree -r --name-only "$PRE_MERGE" | sort) \
        <(git ls-tree -r --name-only HEAD | sort) > "$TO_RESTORE"

    if [ -s "$TO_RESTORE" ]; then
        RESTORE_COUNT=$(wc -l < "$TO_RESTORE" | tr -d ' ')
        log "Restoring $RESTORE_COUNT main-only files deleted by merge..."
        while IFS= read -r f; do
            git checkout "$PRE_MERGE" -- "$f" 2>/dev/null
        done < "$TO_RESTORE"
        git commit -m "Restore main-only files lost during Phase ${PHASE} merge" 2>/dev/null || true
    fi
    rm -f "$TO_RESTORE"

    log "Phase $PHASE merged into main."
done

log "ALL PHASES $START-$END COMPLETE"

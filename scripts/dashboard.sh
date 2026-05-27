#!/bin/bash
# core/scripts/dashboard.sh — Live progress dashboard via GitHub Issues
# Usage:
#   ./core/scripts/dashboard.sh create  --phase=N --attempt=N
#   ./core/scripts/dashboard.sh task-start --issue=N --task=CODENAME --phase=N
#   ./core/scripts/dashboard.sh task-done  --issue=N --task=CODENAME --phase=N --elapsed=MINS [--bugs=COUNT]
#   ./core/scripts/dashboard.sh task-fail  --issue=N --task=CODENAME --phase=N --elapsed=MINS
#   ./core/scripts/dashboard.sh phase-done --issue=N --phase=N [--pr=URL]
#   ./core/scripts/dashboard.sh phase-fail --issue=N --phase=N --task=CODENAME
#
# Creates/updates a GitHub Issue as a live progress dashboard.
# One issue per attempt+phase combo (e.g., "Attempt 3 — Phase 4").
# Your cofounder bookmarks the issue URL and refreshes to see progress.
#
# State is stored in metrics/dashboard-<issue>.tsv (one line per task).
# All calls are idempotent — safe to retry on failure.
# All errors are non-fatal (returns 0 even on gh failures) so the
# pipeline never stops because of a dashboard update.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

# ── Argument parsing ──
COMMAND=""
ISSUE=""
PHASE=""
ATTEMPT=""
TASK=""
ELAPSED=""
BUGS=""
PR_URL=""

COMMAND="${1:-}"
if [ "${COMMAND}" = "--help" ] || [ "${COMMAND}" = "-h" ]; then
    sed -n '2,18p' "$0" | sed -E 's/^# ?//'
    exit 0
fi
shift || true

for arg in "$@"; do
    case "$arg" in
        --issue=*) ISSUE="${arg#--issue=}" ;;
        --phase=*) PHASE="${arg#--phase=}" ;;
        --attempt=*) ATTEMPT="${arg#--attempt=}" ;;
        --task=*) TASK="${arg#--task=}" ;;
        --elapsed=*) ELAPSED="${arg#--elapsed=}" ;;
        --bugs=*) BUGS="${arg#--bugs=}" ;;
        --pr=*) PR_URL="${arg#--pr=}" ;;
    esac
done

STATE_DIR="metrics"
mkdir -p "${STATE_DIR}"

# ── Helpers ──

state_file() {
    echo "${STATE_DIR}/dashboard-${ISSUE}.tsv"
}

# Initialize state file with all tasks as pending
init_state() {
    local PHASE="$1"
    local SF
    SF=$(state_file)
    : > "${SF}"
    for CODENAME in $(phase_tasks "${PHASE}"); do
        local DESC=""
        local SPEC
        SPEC=$(resolve_spec "${CODENAME}" "${PHASE}")
        if [ -n "${SPEC}" ] && [ -f "${SPEC}" ]; then
            DESC=$(head -5 "${SPEC}" | grep -m1 '^#' | sed 's/^#* //')
        fi
        DESC="${DESC:-${CODENAME}}"
        printf '%s\t%s\t%s\t%s\t%s\n' "${CODENAME}" "pending" "0" "0" "${DESC}" >> "${SF}"
    done
}

# Update a task's status in the state file
set_task_status() {
    local CODENAME="$1"
    local STATUS="$2"
    local TASK_ELAPSED="${3:-0}"
    local TASK_BUGS="${4:-0}"
    local SF
    SF=$(state_file)
    [ -f "${SF}" ] || return 0

    local TMPFILE="${SF}.tmp"
    while IFS=$'\t' read -r NAME STAT EL BG DESC; do
        if [ "${NAME}" = "${CODENAME}" ]; then
            printf '%s\t%s\t%s\t%s\t%s\n' "${NAME}" "${STATUS}" "${TASK_ELAPSED}" "${TASK_BUGS}" "${DESC}"
        else
            printf '%s\t%s\t%s\t%s\t%s\n' "${NAME}" "${STAT}" "${EL}" "${BG}" "${DESC}"
        fi
    done < "${SF}" > "${TMPFILE}"
    mv "${TMPFILE}" "${SF}"
}

# Generate the markdown body from state
generate_body() {
    local PHASE="$1"
    local ATTEMPT="$2"
    local EXTRA_FOOTER="${3:-}"
    local SF
    SF=$(state_file)
    [ -f "${SF}" ] || { echo "No state file"; return; }

    local TOTAL=0
    local DONE=0
    local FAILED=0
    local RUNNING=""
    local TOTAL_ELAPSED=0

    while IFS=$'\t' read -r NAME STAT EL BG DESC; do
        TOTAL=$((TOTAL + 1))
        case "${STAT}" in
            done) DONE=$((DONE + 1)); TOTAL_ELAPSED=$((TOTAL_ELAPSED + EL)) ;;
            failed) FAILED=$((FAILED + 1)); TOTAL_ELAPSED=$((TOTAL_ELAPSED + EL)) ;;
            running) RUNNING="${NAME}" ;;
        esac
    done < "${SF}"

    # Phase theme name
    local PHASE_NAME=""
    local README="$(phase_dir_name "${PHASE}")/README.md"
    if [ -f "${README}" ]; then
        PHASE_NAME=$(head -1 "${README}" | sed 's/^#* //')
    fi
    PHASE_NAME="${PHASE_NAME:-Phase ${PHASE}}"

    cat <<HEADER
## Attempt ${ATTEMPT} — Phase ${PHASE}: ${PHASE_NAME}

**Started:** $(date -r "${SF}" +"%Y-%m-%d %H:%M" 2>/dev/null || date +"%Y-%m-%d %H:%M")
**Tasks:** ${DONE}/${TOTAL} complete$([ ${FAILED} -gt 0 ] && echo " (${FAILED} failed)")
$([ -n "${RUNNING}" ] && echo "**Current:** ${RUNNING}")

---

| # | Task | Description | Status | Time | Bugs |
|---|------|-------------|--------|------|------|
HEADER

    local IDX=0
    while IFS=$'\t' read -r NAME STAT EL BG DESC; do
        IDX=$((IDX + 1))
        local STATUS_ICON
        case "${STAT}" in
            done)    STATUS_ICON="Done" ;;
            running) STATUS_ICON="Running" ;;
            failed)  STATUS_ICON="FAILED" ;;
            pending) STATUS_ICON="Pending" ;;
            *)       STATUS_ICON="${STAT}" ;;
        esac
        local TIME_STR="—"
        [ "${EL}" != "0" ] && TIME_STR="${EL}m"
        local BUG_STR="—"
        [ "${STAT}" = "done" ] && BUG_STR="${BG}"
        [ "${STAT}" = "failed" ] && BUG_STR="—"
        echo "| ${IDX} | ${NAME} | ${DESC} | ${STATUS_ICON} | ${TIME_STR} | ${BUG_STR} |"
    done < "${SF}"

    echo ""
    echo "---"
    echo ""

    if [ ${DONE} -eq ${TOTAL} ] && [ ${FAILED} -eq 0 ]; then
        echo "**Phase complete.** Total time: ~${TOTAL_ELAPSED}m"
    elif [ ${FAILED} -gt 0 ]; then
        echo "**Phase stopped.** ${DONE} tasks done, ${FAILED} failed. Elapsed: ~${TOTAL_ELAPSED}m"
    elif [ -n "${RUNNING}" ]; then
        echo "**In progress.** ${DONE}/${TOTAL} tasks done. Elapsed: ~${TOTAL_ELAPSED}m"
    else
        echo "**Queued.** Waiting to start."
    fi

    if [ -n "${EXTRA_FOOTER}" ]; then
        echo ""
        echo "${EXTRA_FOOTER}"
    fi

    echo ""
    echo "---"
    echo "*Auto-updated by Dark Factory. Last update: $(date +"%H:%M")*"
}

# Push the current body to the GitHub issue
push_to_github() {
    local ISSUE_NUM="$1"
    local BODY="$2"

    gh issue edit "${ISSUE_NUM}" --body "${BODY}" 2>/dev/null || {
        echo "  dashboard: failed to update issue #${ISSUE_NUM} (non-fatal)"
        return 0
    }
}

# ══════════════════════════════════════════════════════════════
# Commands
# ══════════════════════════════════════════════════════════════

cmd_create() {
    if [ -z "${PHASE}" ] || [ -z "${ATTEMPT}" ]; then
        echo "Usage: dashboard.sh create --phase=N --attempt=N"
        return 1
    fi

    if ! command -v gh &>/dev/null; then
        echo "  dashboard: gh CLI not available, skipping"
        return 0
    fi

    # Phase theme name
    local PHASE_NAME=""
    local README="$(phase_dir_name "${PHASE}")/README.md"
    if [ -f "${README}" ]; then
        PHASE_NAME=$(head -1 "${README}" | sed 's/^#* //')
    fi
    PHASE_NAME="${PHASE_NAME:-Phase ${PHASE}}"

    local TITLE="Attempt ${ATTEMPT} — Phase ${PHASE}: ${PHASE_NAME}"

    # Create the issue
    local ISSUE_NUM
    ISSUE_NUM=$(gh issue create \
        --title "${TITLE}" \
        --body "Initializing dashboard..." \
        --label "dashboard" \
        2>/dev/null | grep -oE '[0-9]+$') || {
        echo "  dashboard: failed to create issue (non-fatal)"
        return 0
    }

    if [ -z "${ISSUE_NUM}" ]; then
        echo "  dashboard: could not parse issue number (non-fatal)"
        return 0
    fi

    # Ensure the 'dashboard' label exists (ignore errors if it already does)
    gh label create "dashboard" --description "Live progress dashboard" --color "0E8A16" 2>/dev/null || true

    echo "${ISSUE_NUM}"

    # Initialize state and push first update
    ISSUE="${ISSUE_NUM}"
    init_state "${PHASE}"
    local BODY
    BODY=$(generate_body "${PHASE}" "${ATTEMPT}")
    push_to_github "${ISSUE_NUM}" "${BODY}"

    local ISSUE_URL
    ISSUE_URL=$(gh issue view "${ISSUE_NUM}" --json url --jq '.url' 2>/dev/null || echo "")
    if [ -n "${ISSUE_URL}" ]; then
        echo "  Dashboard: ${ISSUE_URL}" >&2
    fi
}

cmd_task_start() {
    [ -z "${ISSUE}" ] || [ -z "${TASK}" ] || [ -z "${PHASE}" ] && return 0

    ISSUE="${ISSUE}"
    set_task_status "${TASK}" "running"
    local BODY
    BODY=$(generate_body "${PHASE}" "${ATTEMPT:-?}")
    push_to_github "${ISSUE}" "${BODY}"
}

cmd_task_done() {
    [ -z "${ISSUE}" ] || [ -z "${TASK}" ] || [ -z "${PHASE}" ] && return 0

    ISSUE="${ISSUE}"
    set_task_status "${TASK}" "done" "${ELAPSED:-0}" "${BUGS:-0}"
    local BODY
    BODY=$(generate_body "${PHASE}" "${ATTEMPT:-?}")
    push_to_github "${ISSUE}" "${BODY}"
}

cmd_task_fail() {
    [ -z "${ISSUE}" ] || [ -z "${TASK}" ] || [ -z "${PHASE}" ] && return 0

    ISSUE="${ISSUE}"
    set_task_status "${TASK}" "failed" "${ELAPSED:-0}" "0"
    local BODY
    BODY=$(generate_body "${PHASE}" "${ATTEMPT:-?}")
    push_to_github "${ISSUE}" "${BODY}"
}

cmd_phase_done() {
    [ -z "${ISSUE}" ] || [ -z "${PHASE}" ] && return 0

    local FOOTER=""
    if [ -n "${PR_URL}" ]; then
        FOOTER="**Phase PR:** ${PR_URL}"
    fi

    ISSUE="${ISSUE}"
    local BODY
    BODY=$(generate_body "${PHASE}" "${ATTEMPT:-?}" "${FOOTER}")
    push_to_github "${ISSUE}" "${BODY}"
}

cmd_phase_fail() {
    [ -z "${ISSUE}" ] || [ -z "${PHASE}" ] && return 0

    local FOOTER="**Phase stopped at task:** ${TASK:-unknown}"
    ISSUE="${ISSUE}"
    local BODY
    BODY=$(generate_body "${PHASE}" "${ATTEMPT:-?}" "${FOOTER}")
    push_to_github "${ISSUE}" "${BODY}"
}

# ── Dispatch ──
case "${COMMAND}" in
    create)     cmd_create ;;
    task-start) cmd_task_start ;;
    task-done)  cmd_task_done ;;
    task-fail)  cmd_task_fail ;;
    phase-done) cmd_phase_done ;;
    phase-fail) cmd_phase_fail ;;
    *)
        echo "Usage: dashboard.sh <create|task-start|task-done|task-fail|phase-done|phase-fail> [OPTIONS]"
        echo ""
        echo "Commands:"
        echo "  create      Create a new dashboard issue"
        echo "  task-start  Mark a task as running"
        echo "  task-done   Mark a task as complete"
        echo "  task-fail   Mark a task as failed"
        echo "  phase-done  Mark the phase as complete"
        echo "  phase-fail  Mark the phase as stopped"
        exit 1
        ;;
esac

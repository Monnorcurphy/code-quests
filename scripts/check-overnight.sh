#!/bin/bash
# core/scripts/check-overnight.sh — Check overnight run status and kick off next phase
# Usage: ./core/scripts/check-overnight.sh [--phase=N] [--attempt=N]
#
# Designed to run from cron. Checks if bugfix is still running, if the
# target phase is running or complete, and kicks it off if needed.
#
# Configuration via flags or env vars:
#   --phase=N       Phase to monitor/launch (default: $CHECK_PHASE or 2)
#   --attempt=N     Attempt number (default: $CHECK_ATTEMPT or 1)
#   --task-count=N  Number of task branches to consider "complete" (default: 3)
#
# Example cron entry (every 15 minutes):
#   */15 * * * * cd /path/to/repo && ./core/scripts/check-overnight.sh --phase=11 --attempt=2

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG="${REPO_ROOT}/metrics/overnight-monitor.log"

PHASE="${CHECK_PHASE:-2}"
ATTEMPT="${CHECK_ATTEMPT:-1}"
TASK_COUNT=3

for arg in "$@"; do
    case "$arg" in
        --phase=*) PHASE="${arg#--phase=}" ;;
        --attempt=*) ATTEMPT="${arg#--attempt=}" ;;
        --task-count=*) TASK_COUNT="${arg#--task-count=}" ;;
        --help|-h)
            sed -n '2,14p' "$0" | sed -E 's/^# ?//'
            exit 0
            ;;
    esac
done

mkdir -p "$(dirname "${LOG}")"

echo "$(date '+%Y-%m-%d %H:%M:%S') — Checking overnight status" >> "$LOG"

# Check if bugfix is still running
if [ -f /tmp/bugfix-loop.pid ] && kill -0 $(cat /tmp/bugfix-loop.pid) 2>/dev/null; then
    DONE=$(ls "${REPO_ROOT}"/metrics/bugfix/done-*.marker 2>/dev/null | wc -l | tr -d ' ')
    FAIL=$(ls "${REPO_ROOT}"/metrics/bugfix/fail-*.marker 2>/dev/null | wc -l | tr -d ' ')
    echo "  Bugfix still running: ${DONE} done, ${FAIL} failed" >> "$LOG"
    exit 0
fi

# Bugfix is done — check if target phase is running
if pgrep -f "phase.sh.*${PHASE}" >/dev/null 2>&1; then
    echo "  Phase ${PHASE} is running" >> "$LOG"
    exit 0
fi

# Check if target phase already completed (look for task branches)
cd "${REPO_ROOT}"
P_DONE=$(git branch -a 2>/dev/null | grep -c "feature/" || true)
if [ "$P_DONE" -ge "$TASK_COUNT" ]; then
    echo "  Phase ${PHASE} appears complete (${P_DONE} task branches found)" >> "$LOG"
    # Remove cron job
    crontab -l 2>/dev/null | grep -v "check-overnight.sh" | crontab -
    echo "  Cron job removed" >> "$LOG"
    exit 0
fi

# Bugfix done, phase NOT running and NOT complete — kick it off
echo "  Bugfix done but Phase ${PHASE} not started — launching now" >> "$LOG"
cd "${REPO_ROOT}"
nohup ./core/scripts/phase.sh "${PHASE}" --attempt="${ATTEMPT}" --skip-dep-check >> "${REPO_ROOT}/metrics/phase${PHASE}-kickoff.log" 2>&1 &
echo "  Phase ${PHASE} launched (PID: $!)" >> "$LOG"

# Remove cron job after launching
crontab -l 2>/dev/null | grep -v "check-overnight.sh" | crontab -
echo "  Cron job removed after launch" >> "$LOG"

#!/bin/bash
# core/scripts/bugfix-then-phase.sh — Run bugfixes then a phase, back-to-back
# Usage: ./core/scripts/bugfix-then-phase.sh <phase-number> [flags]
#
# Runs bugfix.sh first (skips already-fixed bugs), then phase.sh for the
# given phase. Walk-away mode: no prompts, no interaction needed.
#
# Examples:
#   ./core/scripts/bugfix-then-phase.sh 11                    # bugfix then phase 11
#   ./core/scripts/bugfix-then-phase.sh 11 --attempt=3        # bugfix then phase 11 on attempt-3
#   ./core/scripts/bugfix-then-phase.sh 11 --skip-bugfix      # skip bugfix, just run phase 11
#
# Flags:
#   --attempt=N       Target branch (default: main)
#   --skip-bugfix     Skip the bugfix step entirely
#   --skip-dep-check  Pass to phase.sh — bypass phase dependency gate
#   --force           Pass to phase.sh — re-run all tasks
#   --help            Show this help
#
# Emergency stop: kill $(cat /tmp/bugfix-then-phase.pid)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="/tmp/bugfix-then-phase.pid"
echo $$ > "${PID_FILE}"

PHASE=""
ATTEMPT=""
SKIP_BUGFIX=""
PHASE_FLAGS=()

for arg in "$@"; do
    case "$arg" in
        --attempt=*) ATTEMPT="${arg#*=}" ;;
        --skip-bugfix) SKIP_BUGFIX="1" ;;
        --help)
            head -20 "$0" | tail -18
            exit 0
            ;;
        --*)
            PHASE_FLAGS+=("$arg")
            ;;
        *)
            if [ -z "$PHASE" ]; then
                PHASE="$arg"
            fi
            ;;
    esac
done

if [ -z "$PHASE" ]; then
    echo "Usage: ./core/scripts/bugfix-then-phase.sh <phase-number> [flags]"
    echo "Run with --help for details"
    exit 1
fi

LOG_DIR="${SCRIPT_DIR}/../../metrics"
mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/bugfix-then-phase-$(date +%Y-%m-%d_%H-%M).log"

log() {
    echo "$(date '+%H:%M:%S')  $*" | tee -a "${LOG_FILE}"
}

cleanup() {
    log "Run interrupted"
    rm -f "${PID_FILE}"
    exit 130
}
trap cleanup INT TERM

BRANCH="${ATTEMPT:+attempt-${ATTEMPT}}"
BRANCH="${BRANCH:-main}"

log "=== BUGFIX + PHASE ${PHASE} STARTED ==="
log "  Branch: ${BRANCH}"
log "  Log:    ${LOG_FILE}"
log ""

BUGFIX_EXIT=0

# ── Step 1: Bugfixes ──
if [ -z "$SKIP_BUGFIX" ]; then
    log "========================================"
    log "  STEP 1: BUGFIXES"
    log "========================================"
    log ""

    "${SCRIPT_DIR}/bugfix.sh" --branch="${BRANCH}" 2>&1 | tee -a "${LOG_FILE}"
    BUGFIX_EXIT=$?

    if [ "${BUGFIX_EXIT}" -ne 0 ] && [ "${BUGFIX_EXIT}" -ne 130 ]; then
        log ""
        log "  Bugfix exited with code ${BUGFIX_EXIT} — continuing to Phase ${PHASE} anyway"
    fi

    log ""
    log "  Bugfix step complete (exit: ${BUGFIX_EXIT})"
    log ""
else
    log "  Skipping bugfix step (--skip-bugfix)"
    log ""
fi

# ── Step 2: Phase ──
log "========================================"
log "  STEP 2: PHASE ${PHASE}"
log "========================================"
log ""

"${SCRIPT_DIR}/phase.sh" "${PHASE}" ${ATTEMPT:+--attempt=${ATTEMPT}} --skip-dep-check "${PHASE_FLAGS[@]}" 2>&1 | tee -a "${LOG_FILE}"
PHASE_EXIT=$?

log ""
log "  Phase ${PHASE} step complete (exit: ${PHASE_EXIT})"
log ""

# ── Summary ──
log "=== RUN COMPLETE ==="
log "  Bugfix exit:   ${BUGFIX_EXIT}"
log "  Phase ${PHASE} exit: ${PHASE_EXIT}"
log "  Full log:      ${LOG_FILE}"

rm -f "${PID_FILE}"

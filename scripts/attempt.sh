#!/bin/bash
# core/scripts/attempt.sh — Top-level orchestrator: run multiple phases in one attempt
# Usage: ./core/scripts/attempt.sh [--phases=1-10] [--yolo] [--attempt=N] [--dry-run]
#
# Creates an attempt branch from main, runs each phase sequentially via phase.sh,
# then pauses at approval gates for human testing between phases.
#
# Flags:
#   --phases=M-N   Range of phases to run (default: 1-10)
#   --yolo         Pass through to phase.sh/ralph.sh (default: on)
#   --no-yolo      Require Claude permission prompts
#   --attempt=N    Override auto-detection of attempt number
#   --dry-run      Show what would happen without executing
#   --no-force     Skip tasks that already have PRs (default: --force, re-run all)

set -uo pipefail

PHASE_START=1
PHASE_END=10
YOLO="--yolo"
ATTEMPT=""
DRY_RUN=""
FORCE="--force"

for arg in "$@"; do
    case "$arg" in
        --phases=*)
            RANGE="${arg#--phases=}"
            PHASE_START="${RANGE%-*}"
            PHASE_END="${RANGE#*-}"
            ;;
        --yolo) YOLO="--yolo" ;;
        --no-yolo) YOLO="" ;;
        --attempt=*) ATTEMPT="${arg#--attempt=}" ;;
        --dry-run) DRY_RUN="yes" ;;
        --force) FORCE="--force" ;;
        --no-force) FORCE="" ;;
    esac
done

# ── Auto-detect attempt number ──
if [ -z "${ATTEMPT}" ]; then
    MAX_ATTEMPT=$(git branch --list "attempt-*" | sed 's/.*attempt-//' | sort -n | tail -1 | tr -d ' ')
    if [ -z "${MAX_ATTEMPT}" ]; then
        ATTEMPT=1
    else
        ATTEMPT=$((MAX_ATTEMPT + 1))
    fi
fi

ATTEMPT_BRANCH="attempt-${ATTEMPT}"

# ── Count expected tasks ──
TOTAL_TASKS=0
for P in $(seq "${PHASE_START}" "${PHASE_END}"); do
    SPEC_DIR="specs/phase-${P}"
    if [ -d "${SPEC_DIR}" ]; then
        COUNT=$(ls "${SPEC_DIR}"/task-${P}.*.md 2>/dev/null | wc -l | tr -d ' ')
    else
        SPEC_FILE=$(ls specs/features/phase-${P}-*.md 2>/dev/null | head -1)
        if [ -n "${SPEC_FILE}" ]; then
            COUNT=$(grep -oE "TASK ${P}\.[0-9]+" "${SPEC_FILE}" 2>/dev/null | sort -u | wc -l | tr -d ' ')
        else
            COUNT=0
        fi
    fi
    TOTAL_TASKS=$((TOTAL_TASKS + COUNT))
done

PHASE_COUNT=$(( PHASE_END - PHASE_START + 1 ))

echo ""
echo "======================================================================"
echo "  DARK FACTORY — ATTEMPT ${ATTEMPT}"
echo "======================================================================"
echo ""
echo "  Branch:  ${ATTEMPT_BRANCH}"
echo "  Phases:  ${PHASE_START}–${PHASE_END} (${PHASE_COUNT} phases)"
echo "  Tasks:   ~${TOTAL_TASKS} total"
echo "  Mode:    $([ -n "${YOLO}" ] && echo 'AUTONOMOUS' || echo 'SAFE')"
echo ""

if [ -n "${DRY_RUN}" ]; then
    echo "  DRY RUN — would execute:"
    echo ""
    for P in $(seq "${PHASE_START}" "${PHASE_END}"); do
        SPEC_DIR="specs/phase-${P}"
        if [ -d "${SPEC_DIR}" ]; then
            COUNT=$(ls "${SPEC_DIR}"/task-${P}.*.md 2>/dev/null | wc -l | tr -d ' ')
        else
            SPEC_FILE=$(ls specs/features/phase-${P}-*.md 2>/dev/null | head -1)
            if [ -n "${SPEC_FILE}" ]; then
                COUNT=$(grep -oE "TASK ${P}\.[0-9]+" "${SPEC_FILE}" 2>/dev/null | sort -u | wc -l | tr -d ' ')
            else
                COUNT=0
            fi
        fi
        if [ "${COUNT}" -gt 0 ]; then
            echo "  Phase ${P}: ${COUNT} tasks"
            echo "    ./core/scripts/phase.sh ${P} --attempt=${ATTEMPT} ${YOLO}"
            echo "    ./core/scripts/merge-phase.sh ${P} --attempt=${ATTEMPT}"
        else
            echo "  Phase ${P}: (no spec found — would skip or fail)"
        fi
    done
    echo ""
    exit 0
fi

# ── Create attempt branch from main ──
if git rev-parse --verify "${ATTEMPT_BRANCH}" >/dev/null 2>&1; then
    echo "  Using existing ${ATTEMPT_BRANCH}"
else
    echo "  Creating ${ATTEMPT_BRANCH} from main..."
    git checkout main
    git pull origin main 2>/dev/null || true
    git checkout -b "${ATTEMPT_BRANCH}"
    git push -u origin "${ATTEMPT_BRANCH}"
fi

# ── Run each phase ──
mkdir -p metrics
REPORT_FILE="metrics/attempt-${ATTEMPT}-report.md"
START_TIME=$(date +%s)

cat > "${REPORT_FILE}" << EOF
# Attempt ${ATTEMPT} Report

**Started:** $(date)
**Phases:** ${PHASE_START}–${PHASE_END}

| Phase | Status | Time | Tasks |
|-------|--------|------|-------|
EOF

PHASES_COMPLETED=0

for P in $(seq "${PHASE_START}" "${PHASE_END}"); do
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "  ATTEMPT ${ATTEMPT} — PHASE ${P}/${PHASE_END}"
    echo "════════════════════════════════════════════════════════════════"
    echo ""

    PHASE_START_TIME=$(date +%s)

    # Run phase
    SKIP_DEP=""
    if [ "${P}" -eq "${PHASE_START}" ] && [ "${P}" -gt 1 ]; then
        SKIP_DEP="--skip-dep-check"
    fi

    ./core/scripts/phase.sh "${P}" --attempt="${ATTEMPT}" ${YOLO} ${FORCE} ${SKIP_DEP} && PHASE_EXIT=0 || PHASE_EXIT=$?

    PHASE_END_TIME=$(date +%s)
    PHASE_ELAPSED=$(( (PHASE_END_TIME - PHASE_START_TIME) / 60 ))

    if [ ${PHASE_EXIT} -ne 0 ]; then
        echo "| ${P} | FAIL | ~${PHASE_ELAPSED}m | — |" >> "${REPORT_FILE}"
        echo "" >> "${REPORT_FILE}"
        echo "**Failed at phase ${P}**" >> "${REPORT_FILE}"
        echo "**Ended:** $(date)" >> "${REPORT_FILE}"

        echo ""
        echo "======================================================================"
        echo "  ATTEMPT ${ATTEMPT} FAILED AT PHASE ${P}"
        echo "======================================================================"
        echo ""
        echo "  Completed: ${PHASES_COMPLETED} phases"
        echo "  Failed:    phase ${P}"
        echo "  Report:    ${REPORT_FILE}"
        echo ""
        echo "  Resume:"
        echo "    ./core/scripts/phase.sh ${P} --attempt=${ATTEMPT} ${YOLO}"
        echo "    ./core/scripts/merge-phase.sh ${P} --attempt=${ATTEMPT}"
        echo "    ./core/scripts/attempt.sh --phases=$((P+1))-${PHASE_END} --attempt=${ATTEMPT} ${YOLO}"
        echo ""
        exit 1
    fi

    # Count tasks for this phase
    SPEC_DIR="specs/phase-${P}"
    if [ -d "${SPEC_DIR}" ]; then
        TASK_COUNT=$(ls "${SPEC_DIR}"/task-${P}.*.md 2>/dev/null | wc -l | tr -d ' ')
    else
        SPEC_FILE=$(ls specs/features/phase-${P}-*.md 2>/dev/null | head -1)
        TASK_COUNT=$(grep -oE "TASK ${P}\.[0-9]+" "${SPEC_FILE}" 2>/dev/null | sort -u | wc -l | tr -d ' ')
    fi

    echo "| ${P} | PASS | ~${PHASE_ELAPSED}m | ${TASK_COUNT} |" >> "${REPORT_FILE}"
    PHASES_COMPLETED=$((PHASES_COMPLETED + 1))

    # ── Approval gate — stop for user testing ──
    END_TIME=$(date +%s)
    TOTAL_ELAPSED=$(( (END_TIME - START_TIME) / 60 ))

    cat >> "${REPORT_FILE}" << EOF

**Paused:** Phase ${P} complete (approval gate)
**Ended:** $(date)
**Time so far:** ~${TOTAL_ELAPSED} minutes
**Phases completed:** ${PHASES_COMPLETED}/${PHASE_COUNT}
EOF

    echo ""
    echo "======================================================================"
    echo "  PHASE ${P} COMPLETE — APPROVAL GATE"
    echo "======================================================================"
    echo ""
    echo "  Completed ${PHASES_COMPLETED}/${PHASE_COUNT} phases."
    echo "  Report: ${REPORT_FILE}"
    echo ""
    echo "  Next steps:"
    echo "  1. Test the app"
    echo "  2. Review PRs"
    echo "  3. Merge:  ./core/scripts/merge-phase.sh ${P} --attempt=${ATTEMPT}"
    if [ "${P}" -lt "${PHASE_END}" ]; then
        echo "  4. Resume: ./core/scripts/attempt.sh --phases=$((P+1))-${PHASE_END} --attempt=${ATTEMPT} ${YOLO} ${FORCE}"
    fi
    echo ""
    exit 0
done

END_TIME=$(date +%s)
TOTAL_ELAPSED=$(( (END_TIME - START_TIME) / 60 ))

cat >> "${REPORT_FILE}" << EOF

**Ended:** $(date)
**Total time:** ~${TOTAL_ELAPSED} minutes
**Result:** All ${PHASES_COMPLETED} phases complete

## Next Steps
- Review attempt branch: \`git log attempt-${ATTEMPT} --oneline\`
- Promote to main: \`git checkout main && git merge attempt-${ATTEMPT}\`
EOF

echo ""
echo "======================================================================"
echo "  ATTEMPT ${ATTEMPT} COMPLETE"
echo "======================================================================"
echo ""
echo "  Phases:  ${PHASES_COMPLETED} completed"
echo "  Time:    ~${TOTAL_ELAPSED} minutes"
echo "  Branch:  ${ATTEMPT_BRANCH}"
echo "  Report:  ${REPORT_FILE}"
echo ""
echo "  Promote to main:"
echo "    git checkout main && git merge ${ATTEMPT_BRANCH}"
echo ""

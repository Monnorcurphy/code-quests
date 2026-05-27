#!/bin/bash
# core/scripts/project.sh — Run multiple phases sequentially
# Usage: ./scripts/project.sh [OPTIONS]
#
# Orchestrates phases like phase.sh orchestrates tasks. Discovers all phases
# from specs/phase-*/ directories, filters by --start-phase/--stop-phase,
# and runs each via phase.sh.
#
# --start-task is only passed to the FIRST phase (resume mid-phase).
# --stop-task is only passed to the LAST phase (stop mid-phase).
# Middle phases run all their tasks.
#
# Flags:
#   --start-phase=N    Start at phase N (default: first phase found)
#   --stop-phase=N     Stop after phase N (default: last phase found)
#   --start-task=N     Start at task N in the FIRST phase
#   --stop-task=N      Stop after task N in the LAST phase
#   --attempt=N        Attempt number (passed through to phase.sh)
#   --force            Force re-run tasks (passed through)
#   --yolo             Skip confirmation prompts (default: on)
#   --no-yolo          Require confirmation prompts
#   --skip-deps        Skip dependency checks (passed through)
#   --overwrite        Delete existing branches (passed through)
#   --resume           Continue existing branches (passed through)
#   --new-branch       Create -v2, -v3, etc. (passed through)
#   --dry-run          Show what would happen without executing

set -uo pipefail

# ── Source shared helpers ──
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

# ── Argument parsing ──
START_PHASE=""
STOP_PHASE=""
START_TASK=""
STOP_TASK=""
ATTEMPT=""
FORCE=""
YOLO="--yolo"
SKIP_DEPS=""
BRANCH_MODE=""
DRY_RUN=""

usage() {
    echo "Usage: ./scripts/project.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --start-phase=N    Start at phase N (default: first phase found)"
    echo "  --stop-phase=N     Stop after phase N (default: last phase found)"
    echo "  --start-task=N     Start at task N in the FIRST phase"
    echo "  --stop-task=N      Stop after task N in the LAST phase"
    echo "  --attempt=N        Attempt number (passed through to phase.sh)"
    echo "  --force            Force re-run tasks (passed through)"
    echo "  --yolo             Skip confirmation prompts (default: on)"
    echo "  --no-yolo          Require confirmation prompts"
    echo "  --skip-deps        Skip dependency checks (passed through)"
    echo "  --overwrite        Delete existing branches (passed through)"
    echo "  --resume           Continue existing branches (passed through)"
    echo "  --new-branch       Create -v2, -v3, etc. (passed through)"
    echo "  --dry-run          Show what would happen without executing"
    echo ""
    echo "Examples:"
    echo "  ./scripts/project.sh                                    # run all phases"
    echo "  ./scripts/project.sh --start-phase=2 --stop-phase=4    # phases 2-4"
    echo "  ./scripts/project.sh --start-phase=3 --start-task=5    # phase 3 from task 5"
    echo "  ./scripts/project.sh --attempt=2 --force               # re-run on attempt-2"
}

for arg in "$@"; do
    case "$arg" in
        --start-phase=*) START_PHASE="${arg#--start-phase=}" ;;
        --stop-phase=*) STOP_PHASE="${arg#--stop-phase=}" ;;
        --start-task=*) START_TASK="${arg#--start-task=}" ;;
        --stop-task=*) STOP_TASK="${arg#--stop-task=}" ;;
        --attempt=*) ATTEMPT="${arg#--attempt=}" ;;
        --force) FORCE="yes" ;;
        --yolo) YOLO="--yolo" ;;
        --no-yolo) YOLO="" ;;
        --skip-deps) SKIP_DEPS="yes" ;;
        --overwrite|--resume|--new-branch) BRANCH_MODE="$arg" ;;
        --dry-run) DRY_RUN="yes" ;;
        --help|-h) usage; exit 0 ;;
        *)
            echo "  Unknown option: $arg"
            echo ""
            usage
            exit 1
            ;;
    esac
done

# ── Discover phases ──
PHASES=$(ls -d specs/phase-*/ 2>/dev/null | sed -E 's|specs/phase-([0-9]+)/|\1|' | sort -n)

# Also check monolithic specs
for spec in specs/features/phase-*-*.md; do
    [ -f "$spec" ] || continue
    PHASE_NUM=$(echo "$spec" | grep -oE 'phase-([0-9]+)' | grep -oE '[0-9]+')
    [ -n "$PHASE_NUM" ] && PHASES="${PHASES}
${PHASE_NUM}"
done

# Deduplicate and sort
PHASES=$(echo "${PHASES}" | sort -n | uniq | grep -v '^$')

if [ -z "${PHASES}" ]; then
    echo "  No phases discovered."
    echo "  Expected: specs/phase-N/ directories or specs/features/phase-N-*.md files"
    exit 1
fi

FIRST_PHASE=$(echo "${PHASES}" | head -1)
LAST_PHASE=$(echo "${PHASES}" | tail -1)

START_PHASE="${START_PHASE:-${FIRST_PHASE}}"
STOP_PHASE="${STOP_PHASE:-${LAST_PHASE}}"

if [ "${START_PHASE}" -gt "${STOP_PHASE}" ] 2>/dev/null; then
    echo "  --start-phase=${START_PHASE} is after --stop-phase=${STOP_PHASE}"
    exit 1
fi

# Filter phases to the requested range
FILTERED_PHASES=""
for P in $PHASES; do
    if [ "${P}" -ge "${START_PHASE}" ] && [ "${P}" -le "${STOP_PHASE}" ]; then
        FILTERED_PHASES="${FILTERED_PHASES:+${FILTERED_PHASES}
}${P}"
    fi
done

if [ -z "${FILTERED_PHASES}" ]; then
    echo "  No phases found in range ${START_PHASE}-${STOP_PHASE}"
    echo "  Available phases: $(echo $PHASES | tr '\n' ' ')"
    exit 1
fi

PHASES="${FILTERED_PHASES}"
PHASE_COUNT=$(echo "${PHASES}" | wc -l | tr -d ' ')
FIRST_RUNNING=$(echo "${PHASES}" | head -1)
LAST_RUNNING=$(echo "${PHASES}" | tail -1)

# ── Count expected tasks ──
TOTAL_TASKS=0
for P in $PHASES; do
    if has_sequence "${P}"; then
        COUNT=$(task_count "${P}")
    elif [ -d "specs/phase-${P}" ]; then
        COUNT=$(ls "specs/phase-${P}"/task-${P}.*.md 2>/dev/null | wc -l | tr -d ' ')
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

# ── Print header ──
echo ""
echo "======================================================================"
echo "  DARK FACTORY — PROJECT RUN"
echo "======================================================================"
echo ""
echo "  Phases:     ${FIRST_RUNNING}-${LAST_RUNNING} (${PHASE_COUNT} phases)"
echo "  Tasks:      ~${TOTAL_TASKS} total"
echo "  Mode:       $([ -n "${YOLO}" ] && echo 'AUTONOMOUS' || echo 'SAFE')"
echo "  Force:      $([ -n "${FORCE}" ] && echo 'YES' || echo 'no')"
echo "  Attempt:    ${ATTEMPT:-none}"
if [ -n "${START_TASK}" ]; then
    echo "  Start task: ${START_TASK} (first phase only)"
fi
if [ -n "${STOP_TASK}" ]; then
    echo "  Stop task:  ${STOP_TASK} (last phase only)"
fi
echo ""

# ── Dry run ──
if [ -n "${DRY_RUN}" ]; then
    echo "  DRY RUN — would execute:"
    echo ""
    for P in $PHASES; do
        if has_sequence "${P}"; then
            COUNT=$(task_count "${P}")
        elif [ -d "specs/phase-${P}" ]; then
            COUNT=$(ls "specs/phase-${P}"/task-${P}.*.md 2>/dev/null | wc -l | tr -d ' ')
        else
            SPEC_FILE=$(ls specs/features/phase-${P}-*.md 2>/dev/null | head -1)
            if [ -n "${SPEC_FILE}" ]; then
                COUNT=$(grep -oE "TASK ${P}\.[0-9]+" "${SPEC_FILE}" 2>/dev/null | sort -u | wc -l | tr -d ' ')
            else
                COUNT=0
            fi
        fi

        CMD="./scripts/phase.sh ${P}"
        [ -n "${ATTEMPT}" ] && CMD="${CMD} --attempt=${ATTEMPT}"
        [ -n "${YOLO}" ] && CMD="${CMD} --yolo"
        [ -n "${FORCE}" ] && CMD="${CMD} --force"
        [ -n "${SKIP_DEPS}" ] && CMD="${CMD} --skip-dep-check"
        [ -n "${BRANCH_MODE}" ] && CMD="${CMD} ${BRANCH_MODE}"
        if [ "${P}" = "${FIRST_RUNNING}" ] && [ -n "${START_TASK}" ]; then
            CMD="${CMD} --start-task=${START_TASK}"
        fi
        if [ "${P}" = "${LAST_RUNNING}" ] && [ -n "${STOP_TASK}" ]; then
            CMD="${CMD} --stop-task=${STOP_TASK}"
        fi

        if [ "${COUNT}" -gt 0 ]; then
            echo "  Phase ${P}: ${COUNT} tasks"
            echo "    ${CMD}"
        else
            echo "  Phase ${P}: (no spec found — would skip or fail)"
        fi
    done
    echo ""
    exit 0
fi

# ── Run each phase ──
mkdir -p metrics
REPORT_FILE="metrics/project-run-$(date +%Y%m%d-%H%M%S).md"
START_TIME=$(date +%s)

cat > "${REPORT_FILE}" << EOF
# Project Run Report

**Started:** $(date)
**Phases:** ${FIRST_RUNNING}-${LAST_RUNNING}
**Attempt:** ${ATTEMPT:-none}

| Phase | Status | Time | Tasks |
|-------|--------|------|-------|
EOF

PHASES_COMPLETED=0
PHASES_FAILED=""

for P in $PHASES; do
    echo ""
    echo "=================================================================="
    echo "  PROJECT — PHASE ${P}/${LAST_RUNNING}"
    echo "=================================================================="
    echo ""

    PHASE_START_TIME=$(date +%s)

    PHASE_ARGS=""
    [ -n "${ATTEMPT}" ] && PHASE_ARGS="${PHASE_ARGS} --attempt=${ATTEMPT}"
    [ -n "${YOLO}" ] && PHASE_ARGS="${PHASE_ARGS} --yolo"
    [ -n "${FORCE}" ] && PHASE_ARGS="${PHASE_ARGS} --force"
    [ -n "${BRANCH_MODE}" ] && PHASE_ARGS="${PHASE_ARGS} ${BRANCH_MODE}"

    if [ "${P}" = "${FIRST_RUNNING}" ] && [ "${P}" -gt 1 ] && [ -n "${SKIP_DEPS}" ]; then
        PHASE_ARGS="${PHASE_ARGS} --skip-dep-check"
    elif [ -n "${SKIP_DEPS}" ]; then
        PHASE_ARGS="${PHASE_ARGS} --skip-dep-check"
    fi

    if [ "${P}" = "${FIRST_RUNNING}" ] && [ -n "${START_TASK}" ]; then
        PHASE_ARGS="${PHASE_ARGS} --start-task=${START_TASK}"
    fi

    if [ "${P}" = "${LAST_RUNNING}" ] && [ -n "${STOP_TASK}" ]; then
        PHASE_ARGS="${PHASE_ARGS} --stop-task=${STOP_TASK}"
    fi

    # Verify infrastructure before each phase (builders may have deleted scripts)
    if [ ! -f "./scripts/phase.sh" ]; then
        echo "  WARN: scripts/phase.sh missing — restoring infrastructure from main"
        git checkout main -- scripts/ .gitignore CLAUDE.md specs/ 2>/dev/null || true
        git checkout main -- checks/ rules/ factory/ themes/ 2>/dev/null || true
        if git ls-files --cached dist/ 2>/dev/null | head -1 | grep -q .; then
            git rm -r --cached dist/ 2>/dev/null || true
        fi
        if git ls-files --cached node_modules/ 2>/dev/null | head -1 | grep -q .; then
            git rm -r --cached node_modules/ 2>/dev/null || true
        fi
        git add -A && git commit -m "fix: auto-restore infrastructure before phase ${P}" 2>/dev/null || true
    fi

    ./scripts/phase.sh "${P}" ${PHASE_ARGS} && PHASE_EXIT=0 || PHASE_EXIT=$?

    PHASE_END_TIME=$(date +%s)
    PHASE_ELAPSED=$(( (PHASE_END_TIME - PHASE_START_TIME) / 60 ))

    # Count tasks for reporting
    if has_sequence "${P}"; then
        TASK_COUNT=$(task_count "${P}")
    elif [ -d "specs/phase-${P}" ]; then
        TASK_COUNT=$(ls "specs/phase-${P}"/task-${P}.*.md 2>/dev/null | wc -l | tr -d ' ')
    else
        SPEC_FILE=$(ls specs/features/phase-${P}-*.md 2>/dev/null | head -1)
        TASK_COUNT=$(grep -oE "TASK ${P}\.[0-9]+" "${SPEC_FILE}" 2>/dev/null | sort -u | wc -l | tr -d ' ')
    fi

    if [ ${PHASE_EXIT} -ne 0 ]; then
        PHASES_FAILED="${P}"
        echo "| ${P} | FAIL | ~${PHASE_ELAPSED}m | ${TASK_COUNT} |" >> "${REPORT_FILE}"

        if [ -z "${YOLO}" ]; then
            echo "  Phase ${P} failed (exit ${PHASE_EXIT})."
            echo "  Continue to next phase? [y/N] "
            read -r REPLY
            if [ "${REPLY}" != "y" ] && [ "${REPLY}" != "Y" ]; then
                echo "" >> "${REPORT_FILE}"
                echo "**Aborted at phase ${P}**" >> "${REPORT_FILE}"
                echo "**Ended:** $(date)" >> "${REPORT_FILE}"

                echo ""
                echo "  Aborted. Completed ${PHASES_COMPLETED} phase(s)."
                echo "  Report: ${REPORT_FILE}"
                echo ""
                echo "  Resume:"
                echo "    ./scripts/project.sh --start-phase=${P} --stop-phase=${STOP_PHASE} ${ATTEMPT:+--attempt=${ATTEMPT}}"
                echo ""
                exit 1
            fi
            echo "  Continuing to next phase..."
        else
            echo "  Phase ${P} failed (exit ${PHASE_EXIT}). Continuing (--yolo)..."
        fi
    else
        echo "| ${P} | PASS | ~${PHASE_ELAPSED}m | ${TASK_COUNT} |" >> "${REPORT_FILE}"
        PHASES_COMPLETED=$((PHASES_COMPLETED + 1))
    fi
done

END_TIME=$(date +%s)
TOTAL_ELAPSED=$(( (END_TIME - START_TIME) / 60 ))

# ── Write report footer ──
if [ -n "${PHASES_FAILED}" ]; then
    RESULT_TEXT="Completed ${PHASES_COMPLETED}/${PHASE_COUNT} phases (failed: ${PHASES_FAILED})"
else
    RESULT_TEXT="All ${PHASES_COMPLETED} phases complete"
fi

cat >> "${REPORT_FILE}" << EOF

**Ended:** $(date)
**Total time:** ~${TOTAL_ELAPSED} minutes
**Result:** ${RESULT_TEXT}
EOF

# ── Print summary ──
echo ""
echo "======================================================================"
if [ -n "${PHASES_FAILED}" ]; then
    echo "  PROJECT RUN FINISHED (WITH FAILURES)"
else
    echo "  PROJECT RUN COMPLETE"
fi
echo "======================================================================"
echo ""
echo "  Phases:    ${PHASES_COMPLETED}/${PHASE_COUNT} completed"
if [ -n "${PHASES_FAILED}" ]; then
    echo "  Failed:    phase ${PHASES_FAILED}"
fi
echo "  Time:      ~${TOTAL_ELAPSED} minutes"
echo "  Report:    ${REPORT_FILE}"
echo ""
echo "  === APPROVAL GATE ==="
echo "  All phases built. Before merging:"
echo ""
echo "  1. Launch and test the app"
echo "  2. Review PRs for each phase"
echo "  3. Merge each phase when satisfied"
echo ""

# Commit metrics (non-blocking)
./scripts/commit-metrics.sh --scope=project ${ATTEMPT:+--attempt=${ATTEMPT}} || true

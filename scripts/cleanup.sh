#!/bin/bash
# core/scripts/cleanup.sh — End-of-phase cleanup and pattern audit
# Usage: ./core/scripts/cleanup.sh [OPTIONS]
#
# Runs between phases to clean up artifacts, audit for uncovered patterns,
# and generate task specs for systematic fixes (sweeps).
#
# Checks:
#   HARD: verify.sh must pass
#   HARD: no stale review artifacts
#   WARN: uncovered patterns that need sweep tasks
#
# Flags:
#   --generate-sweeps   Auto-generate sweep task specs for found patterns

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/lib.sh" 2>/dev/null || true

GENERATE_SWEEPS=""

for arg in "$@"; do
    case "$arg" in
        --generate-sweeps) GENERATE_SWEEPS="yes" ;;
    esac
done

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║     CLEANUP — INTER-PHASE AUDIT              ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

FAIL=0
WARN=0

# ── HARD: Verify must pass ──
echo "── Verify Gate ──────────────────────────────"
if "${SCRIPT_DIR}/verify.sh" --no-smoke > /dev/null 2>&1; then
    echo "  ✅ verify.sh passes"
else
    echo "  ❌ verify.sh has failures — fix before next phase"
    FAIL=$((FAIL + 1))
fi

# ── HARD: No stale review artifacts ──
echo ""
echo "── Stale Artifacts ──────────────────────────"
STALE_REVIEW=$(ls specs/bugs/review-*.md specs/done/review-pass-*.md 2>/dev/null | wc -l | tr -d ' ')
if [ "${STALE_REVIEW}" -eq 0 ]; then
    echo "  ✅ No stale review artifacts"
else
    echo "  ❌ ${STALE_REVIEW} stale review artifact(s) — delete before next phase"
    FAIL=$((FAIL + 1))
fi

# ── WARN: Pattern audit ──
echo ""
echo "── Pattern Audit ────────────────────────────"

# Check for patterns that indicate systematic issues
declare -A PATTERNS
PATTERNS=(
    ["low-contrast"]="text-gray-[1234]00\|text-neutral-[1234]00\|text-slate-[1234]00"
    ["instanceof-error"]="instanceof Error"
    ["empty-catch"]="catch\s*{"
    ["console-log"]="console\.log"
)

SWEEP_CANDIDATES=""

for PATTERN_NAME in "${!PATTERNS[@]}"; do
    REGEX="${PATTERNS[${PATTERN_NAME}]}"
    COUNT=$(grep -rn "${REGEX}" --include="*.ts" --include="*.tsx" --include="*.rs" . \
        --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=target \
        2>/dev/null | grep -v '\.test\.' | grep -v '\.spec\.' | wc -l | tr -d ' ')

    if [ "${COUNT}" -gt 0 ]; then
        echo "  ⚠️  ${PATTERN_NAME}: ${COUNT} occurrence(s)"
        WARN=$((WARN + 1))
        SWEEP_CANDIDATES="${SWEEP_CANDIDATES}\n- ${PATTERN_NAME}: ${COUNT} occurrences"
    else
        echo "  ✅ ${PATTERN_NAME}: clean"
    fi
done

# ── Generate sweep task specs ──
if [ -n "${GENERATE_SWEEPS}" ] && [ -n "${SWEEP_CANDIDATES}" ]; then
    echo ""
    echo "── Generating Sweep Specs ─────────────────"
    mkdir -p specs/tasks

    for PATTERN_NAME in "${!PATTERNS[@]}"; do
        REGEX="${PATTERNS[${PATTERN_NAME}]}"
        COUNT=$(grep -rn "${REGEX}" --include="*.ts" --include="*.tsx" --include="*.rs" . \
            --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=target \
            2>/dev/null | grep -v '\.test\.' | grep -v '\.spec\.' | wc -l | tr -d ' ')

        if [ "${COUNT}" -gt 0 ]; then
            SPEC_FILE="specs/tasks/sweep-${PATTERN_NAME}.md"
            if [ ! -f "${SPEC_FILE}" ]; then
                cat > "${SPEC_FILE}" << SWEEPEOF
# Sweep: ${PATTERN_NAME}

## Scope
~${COUNT} occurrences across the codebase.

## Pattern
\`${REGEX}\`

## What to fix
Replace all occurrences with the approved alternative.
Run verify.sh after to confirm zero violations.

## Verification
\`grep -rn '${REGEX}' --include="*.ts" --include="*.tsx" --include="*.rs" . | grep -v test | wc -l\` should return 0.
SWEEPEOF
                echo "  Generated: ${SPEC_FILE}"
            fi
        fi
    done
fi

# ── Results ──
echo ""
echo "══════════════════════════════════════════════"
echo "  CLEANUP: ❌ ${FAIL} hard fail | ⚠️  ${WARN} warn"
echo "══════════════════════════════════════════════"
echo ""

if [ ${FAIL} -gt 0 ]; then
    echo "  Fix hard failures before starting next phase."
fi

if [ ${WARN} -gt 0 ]; then
    echo "  Warnings indicate systematic patterns."
    echo "  Generate sweep specs: ./core/scripts/cleanup.sh --generate-sweeps"
fi

echo ""
exit ${FAIL}

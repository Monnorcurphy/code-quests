#!/bin/bash
# core/scripts/phase-retrospective.sh — Post-phase analysis and learning
# Usage: ./core/scripts/phase-retrospective.sh <phase-number>
#
# Captures metrics, analyzes patterns, identifies rule gaps, and feeds
# findings into the learning system. Run after a phase completes.
#
# Output:
#   metrics/retro-phase-{N}.md — Retrospective report
#   FACTORY-KNOWLEDGE.md — New entries appended (via telemetry/document.sh)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/lib.sh" 2>/dev/null || true

PHASE="$1"

if [ -z "${PHASE}" ]; then
    echo "Usage: ./core/scripts/phase-retrospective.sh <phase-number>"
    exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║     PHASE ${PHASE} RETROSPECTIVE               ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

RETRO_FILE="metrics/retro-phase-${PHASE}.md"
mkdir -p metrics

cat > "${RETRO_FILE}" << EOF
# Phase ${PHASE} Retrospective
**Date:** $(date +%Y-%m-%d)

EOF

# ── Bug metrics ──
echo "── Bug Analysis ─────────────────────────────"
TOTAL_BUGS=$(ls specs/bugs/bug-*.md 2>/dev/null | wc -l | tr -d ' ')
REVIEW_BUGS=$(ls specs/bugs/review-*.md 2>/dev/null | wc -l | tr -d ' ')
echo "  Total bug reports: ${TOTAL_BUGS}"
echo "  Review bugs: ${REVIEW_BUGS}"

cat >> "${RETRO_FILE}" << EOF
## Bug Metrics
- Total bug reports: ${TOTAL_BUGS}
- Review bugs: ${REVIEW_BUGS}

EOF

# ── Test metrics ──
echo ""
echo "── Test Metrics ─────────────────────────────"

RUST_TESTS=0
if [ -d "src-tauri" ] || find . -name "Cargo.toml" -not -path "*/target/*" -maxdepth 3 2>/dev/null | head -1 | grep -q .; then
    RUST_TESTS=$(cargo test 2>&1 | grep -oE '[0-9]+ passed' | head -1 | grep -oE '[0-9]+' || echo 0)
    echo "  Rust tests: ${RUST_TESTS} passing"
fi

JS_TESTS=0
if [ -f "package.json" ]; then
    JS_TESTS=$(pnpm test 2>&1 | grep -oE 'Tests.*[0-9]+ passed' | grep -oE '[0-9]+ passed' | grep -oE '[0-9]+' || echo 0)
    echo "  JS tests: ${JS_TESTS} passing"
fi

cat >> "${RETRO_FILE}" << EOF
## Test Metrics
- Rust tests: ${RUST_TESTS}
- JS tests: ${JS_TESTS}
- Total: $((RUST_TESTS + JS_TESTS))

EOF

# ── Verify check coverage ──
echo ""
echo "── Verify Check Coverage ────────────────────"

CHECKS_DIR="${SCRIPT_DIR}/../../checks"
TOTAL_CHECKS=$(ls "${CHECKS_DIR}/"*.sh 2>/dev/null | wc -l | tr -d ' ')
PASSING_CHECKS=0
FAILING_CHECKS=0
FAILING_NAMES=""

for CHECK in "${CHECKS_DIR}/"*.sh; do
    CHECK_NAME=$(basename "${CHECK}" .sh)
    if "${CHECK}" . > /dev/null 2>&1; then
        PASSING_CHECKS=$((PASSING_CHECKS + 1))
    else
        FAILING_CHECKS=$((FAILING_CHECKS + 1))
        FAILING_NAMES="${FAILING_NAMES}\n  - ${CHECK_NAME}"
    fi
done

echo "  Total checks: ${TOTAL_CHECKS}"
echo "  Passing: ${PASSING_CHECKS}"
echo "  Failing: ${FAILING_CHECKS}"

cat >> "${RETRO_FILE}" << EOF
## Verify Check Coverage
- Total checks: ${TOTAL_CHECKS}
- Passing: ${PASSING_CHECKS}
- Failing: ${FAILING_CHECKS}
$([ -n "${FAILING_NAMES}" ] && echo -e "- Failing checks:${FAILING_NAMES}")

EOF

# ── Rule gap analysis ──
echo ""
echo "── Rule Gap Analysis ────────────────────────"

# Check if bugs reveal patterns not covered by existing rules
RULE_COUNT=$(find rules/ .claude/rules/ -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
echo "  Active rules: ${RULE_COUNT}"

# Count bug categories if CATALOG exists
if [ -f "specs/bugs/CATALOG.md" ]; then
    echo "  Bug catalog exists — checking for uncovered categories"
fi

cat >> "${RETRO_FILE}" << EOF
## Rule Gap Analysis
- Active rules: ${RULE_COUNT}
- Review specs/bugs/ for patterns that lack corresponding rules or checks

## Recommendations
1. If any check is failing, add a fix to the next phase's first task
2. If bugs cluster in a category, add a new check to checks/
3. If the same bug was filed 2+ times, it needs a structural fix (rule or check), not just a code fix
4. Run \`./telemetry/document.sh\` to record any new learnings in FACTORY-KNOWLEDGE.md

EOF

echo ""
echo "  Retrospective saved to: ${RETRO_FILE}"
echo ""
echo "  Next steps:"
echo "    1. Review ${RETRO_FILE}"
echo "    2. Run ./telemetry/document.sh to record learnings"
echo "    3. Create new checks for any uncovered bug patterns"
echo "    4. Update rules if specs were unclear"
echo ""

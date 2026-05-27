#!/bin/bash
# core/scripts/incident.sh — Generate incident packet on repeated failures
# Usage: ./core/scripts/incident.sh <task-id> <failing-command> <exit-code> [category]
#
# Categories: BRANCH_PROMPT, WRONG_PARENT, DIR_MISMATCH, VERIFY_TOO_STRICT,
#             CI_AUTH, TOOL_MISSING, BUILD_FAIL, TEST_FAIL, OTHER
#
# Output: incidents/incident-<task-id>-<timestamp>.md

set -uo pipefail

TASK_ID="${1:?Usage: incident.sh <task-id> <failing-command> <exit-code> [category]}"
FAILING_CMD="${2:?}"
EXIT_CODE="${3:?}"
CATEGORY="${4:-OTHER}"

TIMESTAMP=$(date +%Y-%m-%d_%H-%M)
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
COMMIT=$(git log -1 --oneline 2>/dev/null || echo "unknown")

mkdir -p incidents

INCIDENT_FILE="incidents/incident-${TASK_ID}-${TIMESTAMP}.md"

# Collect verify summary if available
VERIFY_EXCERPT=""
LATEST_VERIFY=$(ls -1t metrics/verify-*.txt 2>/dev/null | head -1)
if [ -n "$LATEST_VERIFY" ]; then
    VERIFY_EXCERPT=$(tail -20 "$LATEST_VERIFY")
fi

# Collect bug titles
BUG_LIST=""
for bug in specs/bugs/review-*.md; do
    [ -f "$bug" ] && BUG_LIST+="- $(head -1 "$bug" | sed 's/^# //')"$'\n'
done

# Determine recommended fix type
FIX_TYPE="OTHER"
case "${CATEGORY}" in
    BRANCH_PROMPT|WRONG_PARENT) FIX_TYPE="SCRIPT" ;;
    DIR_MISMATCH)               FIX_TYPE="SCRIPT" ;;
    VERIFY_TOO_STRICT)          FIX_TYPE="CHECK" ;;
    CI_AUTH|TOOL_MISSING)       FIX_TYPE="PROFILE" ;;
    BUILD_FAIL|TEST_FAIL)       FIX_TYPE="RULE" ;;
esac

cat > "${INCIDENT_FILE}" << INCIDENT
# Incident: Task ${TASK_ID} — ${CATEGORY}

**Generated:** ${TIMESTAMP}
**Branch:** ${BRANCH}
**Commit:** ${COMMIT}
**Category:** ${CATEGORY}

## Failing Command
\`\`\`
${FAILING_CMD}
Exit code: ${EXIT_CODE}
\`\`\`

## Verify Summary Excerpt
\`\`\`
${VERIFY_EXCERPT:-No verify report available}
\`\`\`

## Bug Files
${BUG_LIST:-None filed}

## Recommended Fix Type
**${FIX_TYPE}** — $(case "${FIX_TYPE}" in
    CHECK)   echo "Add or adjust a deterministic check" ;;
    SCRIPT)  echo "Fix orchestration logic" ;;
    RULE)    echo "Update rule pack" ;;
    PROFILE) echo "Update or create profile adapter" ;;
    DOC)     echo "Update documentation" ;;
    *)       echo "Investigate manually" ;;
esac)
INCIDENT

echo "  📋 Incident filed: ${INCIDENT_FILE}"

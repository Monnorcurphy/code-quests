#!/bin/bash
# telemetry/document.sh — Append lessons learned after task completion
# Usage: ./telemetry/document.sh <task-id> [category] [lesson]
#
# If called without lesson, auto-generates from incident/bug artifacts.
# Appends to FACTORY-KNOWLEDGE.md in format:
#   YYYY-MM-DD — CATEGORY — Lesson — Factory Fix

set -uo pipefail

TASK_ID="${1:?Usage: document.sh <task-id> [category] [lesson]}"
CATEGORY="${2:-GENERAL}"
LESSON="${3:-}"

KNOWLEDGE_FILE="FACTORY-KNOWLEDGE.md"
DATE=$(date +%Y-%m-%d)

# Create knowledge file if it doesn't exist
if [ ! -f "${KNOWLEDGE_FILE}" ]; then
    cat > "${KNOWLEDGE_FILE}" << 'HEADER'
# Factory Knowledge Base

Lessons learned from factory operations. Auto-generated and append-only.
Format: `YYYY-MM-DD — CATEGORY — Lesson — Factory Fix`

---

HEADER
fi

if [ -n "${LESSON}" ]; then
    # Manual lesson
    echo "- ${DATE} — ${CATEGORY} — ${LESSON}" >> "${KNOWLEDGE_FILE}"
    echo "  📝 Lesson recorded"
else
    # Auto-generate from artifacts
    ENTRIES=0

    # From incident packets
    for incident in incidents/incident-${TASK_ID}-*.md; do
        [ -f "$incident" ] || continue
        INC_CATEGORY=$(grep "^**Category:**" "$incident" 2>/dev/null | sed 's/.*\*\* //')
        INC_FIX=$(grep "^**${INC_CATEGORY}" "$incident" 2>/dev/null | head -1)
        echo "- ${DATE} — ${INC_CATEGORY:-INCIDENT} — Task ${TASK_ID} incident — See $(basename "$incident")" >> "${KNOWLEDGE_FILE}"
        ENTRIES=$((ENTRIES + 1))
    done

    # From bug files that weren't resolved
    for bug in specs/bugs/review-*.md; do
        [ -f "$bug" ] || continue
        BUG_TITLE=$(head -1 "$bug" | sed 's/^# //')
        BUG_SEV=$(grep "^\*\*Severity:\*\*" "$bug" 2>/dev/null | sed 's/.*\*\* //')
        echo "- ${DATE} — REVIEW — ${BUG_TITLE} (${BUG_SEV}) — Unresolved after fixer rounds" >> "${KNOWLEDGE_FILE}"
        ENTRIES=$((ENTRIES + 1))
    done

    if [ ${ENTRIES} -eq 0 ]; then
        echo "- ${DATE} — SUCCESS — Task ${TASK_ID} completed cleanly" >> "${KNOWLEDGE_FILE}"
        ENTRIES=1
    fi

    echo "  📝 ${ENTRIES} lesson(s) recorded to ${KNOWLEDGE_FILE}"
fi

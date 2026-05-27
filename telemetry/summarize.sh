#!/bin/bash
# telemetry/summarize.sh — Weekly rollup of factory operations
# Usage: ./telemetry/summarize.sh
#
# Reads FACTORY-KNOWLEDGE.md and metrics/ to produce a summary of:
#   - Recurring failure categories
#   - Top offenders (most frequent issues)
#   - Success rate

set -uo pipefail

KNOWLEDGE_FILE="FACTORY-KNOWLEDGE.md"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║     DARK FACTORY — WEEKLY SUMMARY             ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── Total entries ──
if [ -f "${KNOWLEDGE_FILE}" ]; then
    TOTAL=$(grep "^- " "${KNOWLEDGE_FILE}" | wc -l | tr -d ' ')
    echo "  Total knowledge entries: ${TOTAL}"
    echo ""

    # ── Category breakdown ──
    echo "── Category Breakdown ─────────────────────────"
    grep "^- " "${KNOWLEDGE_FILE}" | sed 's/.*— \([A-Z_]*\) —.*/\1/' | sort | uniq -c | sort -rn | while read count category; do
        printf "  %3d  %s\n" "$count" "$category"
    done
    echo ""

    # ── Recent entries (last 7 days) ──
    echo "── Recent Entries (last 7 days) ────────────────"
    WEEK_AGO=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d '7 days ago' +%Y-%m-%d 2>/dev/null || echo "0000-00-00")
    grep "^- " "${KNOWLEDGE_FILE}" | while IFS= read -r line; do
        ENTRY_DATE=$(echo "$line" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
        if [[ "$ENTRY_DATE" > "$WEEK_AGO" ]] || [[ "$ENTRY_DATE" == "$WEEK_AGO" ]]; then
            echo "  $line"
        fi
    done
    echo ""
else
    echo "  No knowledge file found. Run tasks to generate entries."
    echo ""
fi

# ── Incident count ──
echo "── Incidents ──────────────────────────────────"
INCIDENT_COUNT=$(ls incidents/*.md 2>/dev/null | wc -l | tr -d ' ')
echo "  Total incidents: ${INCIDENT_COUNT}"
echo ""

# ── Verify report stats ──
echo "── Verification Reports ───────────────────────"
REPORT_COUNT=$(ls metrics/verify-*.txt 2>/dev/null | wc -l | tr -d ' ')
echo "  Total reports: ${REPORT_COUNT}"

if [ ${REPORT_COUNT} -gt 0 ]; then
    HARD_FAILS=$(grep -l "HARD FAIL" metrics/verify-*.txt 2>/dev/null | wc -l | tr -d ' ')
    CLEAN=$(( REPORT_COUNT - HARD_FAILS ))
    echo "  Clean runs: ${CLEAN}"
    echo "  Hard fails: ${HARD_FAILS}"
fi
echo ""

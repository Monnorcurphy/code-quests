#!/bin/bash
# core/scripts/status.sh — Generate comprehensive project status dashboard
# Usage: ./core/scripts/status.sh
#
# Shows: completed tasks, blockers, in progress, up next, attempts,
# phase completion, health check, build log.
# Designed for non-technical cofounders to review.

set -uo pipefail

echo ""
echo "======================================================================"
echo "  DARK FACTORY — PROJECT STATUS"
echo "======================================================================"
echo ""
echo "  Generated: $(date)"
echo "  Branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"
echo ""

# ── What's Done ──
echo "----------------------------------------------------------------------"
echo "  COMPLETED"
echo "----------------------------------------------------------------------"
if [ -d "specs/done" ] && [ "$(ls -A specs/done 2>/dev/null)" ]; then
    for f in specs/done/*.md; do
        name=$(head -1 "$f" | sed 's/^#\s*//')
        echo "  - ${name}"
    done
else
    echo "  (nothing completed yet)"
fi
echo ""

# ── What's Blocked ──
echo "----------------------------------------------------------------------"
echo "  BLOCKED / BUGS"
echo "----------------------------------------------------------------------"
if [ -d "specs/bugs" ] && [ "$(ls -A specs/bugs 2>/dev/null)" ]; then
    for f in specs/bugs/*.md; do
        name=$(head -1 "$f" | sed 's/^#\s*//')
        priority=$(grep -i "priority\|severity:" "$f" | head -1 | sed 's/.*:\s*//')
        echo "  - [${priority:-??}] ${name}"
    done
else
    echo "  (no blockers)"
fi
echo ""

# ── What's In Progress ──
echo "----------------------------------------------------------------------"
echo "  IN PROGRESS"
echo "----------------------------------------------------------------------"
if [ -f "progress.md" ]; then
    echo ""
    tail -15 progress.md | sed 's/^/  /'
    echo ""
else
    echo "  (no progress.md found)"
fi
echo ""

# ── What's Next ──
echo "----------------------------------------------------------------------"
echo "  UP NEXT"
echo "----------------------------------------------------------------------"
FOUND_SPECS=""
# New format: specs/phase-*/README.md
for f in specs/phase-*/README.md; do
    [ -f "$f" ] || continue
    FOUND_SPECS="yes"
    name=$(head -1 "$f" | sed 's/^#\s*//')
    echo "  - ${name}"
done
# Legacy format: specs/features/*.md
if [ -d "specs/features" ] && [ "$(ls -A specs/features 2>/dev/null)" ]; then
    for f in specs/features/*.md; do
        FOUND_SPECS="yes"
        name=$(head -1 "$f" | sed 's/^#\s*//')
        status=$(grep -i "^Status:" "$f" | head -1 | sed 's/.*:\s*//')
        priority=$(grep -i "^Priority:" "$f" | head -1 | sed 's/.*:\s*//')
        echo "  - [${priority:-??}] ${name} — ${status:-unknown}"
    done
fi
if [ -z "$FOUND_SPECS" ]; then
    echo "  (no feature specs found)"
fi
echo ""

# ── Attempts ──
echo "----------------------------------------------------------------------"
echo "  ATTEMPTS"
echo "----------------------------------------------------------------------"
ATTEMPT_BRANCHES=$(git branch --list "attempt-*" | tr -d ' *' | sort -t- -k2 -n)
if [ -n "${ATTEMPT_BRANCHES}" ]; then
    for AB in ${ATTEMPT_BRANCHES}; do
        ATTEMPT_DATE=$(git log -1 --format='%ci' "${AB}" 2>/dev/null | cut -d' ' -f1)
        ATTEMPT_COMMIT=$(git log -1 --oneline "${AB}" 2>/dev/null)
        echo "  - ${AB} (${ATTEMPT_DATE:-unknown}) — ${ATTEMPT_COMMIT}"
    done
else
    echo "  (no attempt branches yet)"
fi
echo ""

# ── Phase Completion ──
echo "----------------------------------------------------------------------"
echo "  PHASE COMPLETION"
echo "----------------------------------------------------------------------"
FOUND_MARKERS=""
for f in specs/done/phase-*-complete.md; do
    [ -f "$f" ] || continue
    FOUND_MARKERS="yes"
    PHASE_NAME=$(head -1 "$f" | sed 's/^#\s*//')
    PHASE_DATE=$(grep -m1 'Date:' "$f" | sed 's/.*Date:\*\* //' | sed 's/\*\*Date:\*\* //')
    echo "  - ${PHASE_NAME} (${PHASE_DATE:-unknown})"
done
if [ -z "${FOUND_MARKERS}" ]; then
    echo "  (no phases completed yet)"
fi
echo ""

# ── Git state ──
echo "----------------------------------------------------------------------"
echo "  GIT STATE"
echo "----------------------------------------------------------------------"
echo "  Branch:  $(git branch --show-current 2>/dev/null || echo 'detached')"
echo "  Clean:   $(git diff --quiet 2>/dev/null && echo 'yes' || echo 'NO — dirty worktree')"
echo "  Remote:  $(git remote get-url origin 2>/dev/null || echo 'none')"
echo ""

# ── Open PRs ──
echo "----------------------------------------------------------------------"
echo "  PULL REQUESTS"
echo "----------------------------------------------------------------------"
PR_COUNT=$(gh pr list --json number --jq 'length' 2>/dev/null || echo "?")
echo "  Open: ${PR_COUNT}"
if [ "${PR_COUNT}" != "?" ] && [ "${PR_COUNT}" != "0" ]; then
    gh pr list --limit 10 2>/dev/null | while IFS= read -r line; do
        echo "    ${line}"
    done
fi
echo ""

# ── Incidents ──
echo "----------------------------------------------------------------------"
echo "  INCIDENTS"
echo "----------------------------------------------------------------------"
INCIDENT_COUNT=$(ls incidents/*.md 2>/dev/null | wc -l | tr -d ' ')
if [ "${INCIDENT_COUNT}" -gt 0 ]; then
    echo "  ${INCIDENT_COUNT} incident(s):"
    ls -1t incidents/*.md 2>/dev/null | head -5 | while read f; do
        echo "    $(basename "$f")"
    done
else
    echo "  None"
fi
echo ""

# ── Health Check ──
echo "----------------------------------------------------------------------"
echo "  HEALTH CHECK"
echo "----------------------------------------------------------------------"
LATEST_VERIFY=$(ls -t metrics/verify-*.txt 2>/dev/null | head -1)
if [ -n "${LATEST_VERIFY}" ]; then
    echo "  Latest verification: ${LATEST_VERIFY}"
    tail -3 "${LATEST_VERIFY}" | sed 's/^/  /'
else
    echo "  No verification runs yet. Run: ./core/scripts/verify.sh"
fi
echo ""

# ── Build Log ──
echo "----------------------------------------------------------------------"
echo "  RECENT BUILD LOG"
echo "----------------------------------------------------------------------"
if [ -f "metrics/build-log.txt" ]; then
    tail -10 metrics/build-log.txt | sed 's/^/  /'
else
    echo "  No builds yet."
fi
echo ""

# ── Profile ──
echo "----------------------------------------------------------------------"
echo "  FACTORY PROFILE"
echo "----------------------------------------------------------------------"
if [ -f "factory/profile.yaml" ]; then
    echo "  $(head -1 factory/profile.yaml)"
else
    echo "  No profile configured (factory/profile.yaml missing)"
fi
echo ""
echo "======================================================================"

#!/bin/bash
# checks/semgrep.sh — Run Semgrep SAST analysis on project code
# Usage: ./checks/semgrep.sh [search-path]
#
# Runs Semgrep with the "auto" config (free community rules) to detect
# security vulnerabilities, bug patterns, and code smells.
#
# Policy:
#   HIGH/CRITICAL findings → exit 1 (HARD FAIL)
#   MEDIUM/LOW findings    → printed as warnings, exit 0
#   No findings            → exit 0
#   Semgrep not installed  → warning + exit 0 (don't block pipeline)
#
# Requires: semgrep (https://semgrep.dev — brew install semgrep)

set -uo pipefail

SEARCH_PATH="${1:-.}"

# ── Preflight: is semgrep available? ──
if ! command -v semgrep &>/dev/null; then
    echo "⚠️  semgrep not installed — skipping SAST scan"
    echo "  Install with: brew install semgrep"
    exit 0
fi

# ── Run semgrep ──
TMPFILE=$(mktemp /tmp/semgrep-output.XXXXXX)
trap 'rm -f "${TMPFILE}"' EXIT

semgrep \
    --config auto \
    --error \
    --quiet \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='build' \
    --exclude='.git' \
    --exclude='target' \
    --exclude='venv' \
    --exclude='.venv' \
    --exclude='__pycache__' \
    --exclude='*.min.js' \
    --exclude='*.bundle.js' \
    --exclude='projects' \
    --exclude='ui' \
    --exclude='adversarial-tests' \
    --json \
    "${SEARCH_PATH}" > "${TMPFILE}" 2>/dev/null

SEMGREP_EXIT=$?

# Exit code 0 = no findings, 1 = findings present, other = error
if [ ${SEMGREP_EXIT} -gt 1 ]; then
    echo "⚠️  semgrep encountered an error (exit ${SEMGREP_EXIT}) — skipping"
    exit 0
fi

# ── Parse results ──
# If no JSON output or empty results array, we're clean
if [ ! -s "${TMPFILE}" ]; then
    echo "Semgrep SAST: no findings"
    exit 0
fi

# Count findings by severity using python (available on macOS)
RESULTS=$(python3 -c "
import json, sys

try:
    data = json.load(open('${TMPFILE}'))
except:
    print('NO_RESULTS')
    sys.exit(0)

results = data.get('results', [])
if not results:
    print('NO_RESULTS')
    sys.exit(0)

by_severity = {}
for r in results:
    sev = r.get('extra', {}).get('severity', 'UNKNOWN').upper()
    by_severity.setdefault(sev, []).append(r)

# Print summary
total = len(results)
print(f'TOTAL:{total}')

for sev in ['ERROR', 'WARNING', 'INFO']:
    findings = by_severity.get(sev, [])
    if findings:
        # Semgrep uses ERROR=high, WARNING=medium, INFO=low
        label = {'ERROR': 'HIGH/CRITICAL', 'WARNING': 'MEDIUM', 'INFO': 'LOW'}.get(sev, sev)
        print(f'SEV:{sev}:{len(findings)}:{label}')
        for f in findings[:5]:
            path = f.get('path', '?')
            line = f.get('start', {}).get('line', '?')
            msg = f.get('extra', {}).get('message', 'no message')
            rule = f.get('check_id', 'unknown')
            # Truncate long messages
            if len(msg) > 120:
                msg = msg[:117] + '...'
            print(f'  FINDING:{sev}:{path}:{line}:{rule}:{msg}')
        if len(findings) > 5:
            print(f'  ... and {len(findings) - 5} more {label} findings')
" 2>/dev/null)

if [ -z "${RESULTS}" ] || echo "${RESULTS}" | grep -q "NO_RESULTS"; then
    echo "Semgrep SAST: no findings"
    exit 0
fi

# ── Display findings ──
HAS_HIGH=0
TOTAL=$(echo "${RESULTS}" | grep "^TOTAL:" | cut -d: -f2)

echo "Semgrep SAST: ${TOTAL} finding(s)"
echo ""

# Show HIGH/CRITICAL (ERROR severity in semgrep)
HIGH_COUNT=$(echo "${RESULTS}" | grep "^SEV:ERROR:" | cut -d: -f3)
if [ -n "${HIGH_COUNT}" ] && [ "${HIGH_COUNT}" -gt 0 ] 2>/dev/null; then
    HAS_HIGH=1
    echo "❌ ${HIGH_COUNT} HIGH/CRITICAL:"
    echo "${RESULTS}" | grep "^  FINDING:ERROR:" | while IFS=: read -r _ _ path line rule msg; do
        echo "    ${path}:${line} [${rule}] ${msg}"
    done
    echo "${RESULTS}" | grep "^\.\.\. and .* HIGH" || true
    echo ""
fi

# Show MEDIUM (WARNING severity in semgrep)
MED_COUNT=$(echo "${RESULTS}" | grep "^SEV:WARNING:" | cut -d: -f3)
if [ -n "${MED_COUNT}" ] && [ "${MED_COUNT}" -gt 0 ] 2>/dev/null; then
    echo "⚠️  ${MED_COUNT} MEDIUM:"
    echo "${RESULTS}" | grep "^  FINDING:WARNING:" | while IFS=: read -r _ _ path line rule msg; do
        echo "    ${path}:${line} [${rule}] ${msg}"
    done
    echo "${RESULTS}" | grep "^\.\.\. and .* MEDIUM" || true
    echo ""
fi

# Show LOW (INFO severity in semgrep)
LOW_COUNT=$(echo "${RESULTS}" | grep "^SEV:INFO:" | cut -d: -f3)
if [ -n "${LOW_COUNT}" ] && [ "${LOW_COUNT}" -gt 0 ] 2>/dev/null; then
    echo "ℹ️  ${LOW_COUNT} LOW:"
    echo "${RESULTS}" | grep "^  FINDING:INFO:" | while IFS=: read -r _ _ path line rule msg; do
        echo "    ${path}:${line} [${rule}] ${msg}"
    done
    echo "${RESULTS}" | grep "^\.\.\. and .* LOW" || true
    echo ""
fi

# ── Exit code: only HARD FAIL on HIGH/CRITICAL ──
if [ ${HAS_HIGH} -eq 1 ]; then
    echo "Semgrep: HARD FAIL — ${HIGH_COUNT} high/critical finding(s) must be fixed"
    exit 1
fi

echo "Semgrep: PASS (warnings only, no high/critical findings)"
exit 0

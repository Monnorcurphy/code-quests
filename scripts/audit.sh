#!/bin/bash
# core/scripts/audit.sh — Context window audit for Ralph Loop sessions
# Usage: ./core/scripts/audit.sh <task-id> [--builder|--reviewer|--fixer|--pr]
#        ./core/scripts/audit.sh --latest
#        ./core/scripts/audit.sh --all
#
# Produces:
#   metrics/audit-task-{id}.md    — human-readable report
#   metrics/audit-task-{id}.json  — machine-readable (paste to Claude for analysis)
#
# No LLM calls. No tokens. Pure local computation.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
python3 "${SCRIPT_DIR}/audit.py" "$@"

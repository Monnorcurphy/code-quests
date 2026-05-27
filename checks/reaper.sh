#!/bin/bash
# checks/reaper.sh — Kill only tracked PIDs (never pkill -f globally)
# Usage: ./checks/reaper.sh [pid-file-dir]
#
# Reads PID files from the specified directory (default: /tmp/dark-factory-*)
# and kills only those processes. Safe — never does broad pkill.

PID_DIR="${1:-/tmp}"
PATTERN="dark-factory-*.pid"

KILLED=0
STALE=0

for pidfile in ${PID_DIR}/${PATTERN}; do
    [ -f "$pidfile" ] || continue
    PID=$(cat "$pidfile" 2>/dev/null)
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        echo "  Killing PID ${PID} ($(basename "$pidfile"))"
        kill "$PID" 2>/dev/null
        KILLED=$((KILLED + 1))
    else
        echo "  Removing stale PID file: $(basename "$pidfile")"
        STALE=$((STALE + 1))
    fi
    rm -f "$pidfile"
done

echo "  Reaped: ${KILLED} killed, ${STALE} stale PID files removed"

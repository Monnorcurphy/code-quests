#!/bin/bash
# smoke-test.sh — Start dev server, verify it responds, then stop it.
set -uo pipefail

pnpm dev &
DEV_PID=$!
sleep 5

if curl -sf http://localhost:5173 > /dev/null 2>&1 || curl -sf http://localhost:3000 > /dev/null 2>&1; then
  kill $DEV_PID 2>/dev/null; wait $DEV_PID 2>/dev/null; exit 0
else
  kill $DEV_PID 2>/dev/null; wait $DEV_PID 2>/dev/null; exit 1
fi

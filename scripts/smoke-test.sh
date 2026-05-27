#!/bin/bash
# smoke-test.sh — Start dev servers, verify they respond, then stop them.
set -uo pipefail

# Start backend server
pnpm --filter server dev &
SERVER_PID=$!

# Start Vite dev server
pnpm --filter client dev &
DEV_PID=$!

cleanup() {
  kill $DEV_PID 2>/dev/null; wait $DEV_PID 2>/dev/null
  kill $SERVER_PID 2>/dev/null; wait $SERVER_PID 2>/dev/null
}

sleep 6

# Check Vite dev server responds
if ! curl -sf http://localhost:5173 > /dev/null 2>&1 && ! curl -sf http://localhost:3000 > /dev/null 2>&1; then
  echo "ERROR: Vite dev server did not start"
  cleanup; exit 1
fi

# Check API server responds and returns CORS header when Origin is provided
CORS_HEADER=$(curl -sf -H "Origin: http://localhost:5173" -I http://localhost:4001/health 2>/dev/null | grep -i "access-control-allow-origin" || true)
if [ -z "$CORS_HEADER" ]; then
  # Vite proxy approach — verify /health proxied through Vite returns data
  HEALTH=$(curl -sf http://localhost:5173/health 2>/dev/null || true)
  if [ -z "$HEALTH" ]; then
    echo "ERROR: /health endpoint not reachable via Vite proxy or direct"
    cleanup; exit 1
  fi
fi

# Verify GET /adventurers is reachable via Vite proxy (no CORS issues)
ROSTER=$(curl -sf http://localhost:5173/adventurers 2>/dev/null || true)
if [ -z "$ROSTER" ]; then
  echo "ERROR: GET /adventurers not reachable via Vite proxy"
  cleanup; exit 1
fi

echo "Smoke test passed"
cleanup; exit 0

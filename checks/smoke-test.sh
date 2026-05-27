#!/bin/bash
# Smoke test: start dev server and verify both client and server respond
set -euo pipefail

set -m  # enable job control so children get their own process group
pnpm dev &
DEV_PID=$!
DEV_PGID=$DEV_PID

cleanup() {
  kill -- -"$DEV_PGID" 2>/dev/null || true
}
trap cleanup EXIT

# Poll up to 30 seconds for the Vite client to come up
for _ in $(seq 1 30); do
  if curl -sf http://localhost:5173 > /dev/null 2>&1; then break; fi
  sleep 1
done

# Poll up to 30 seconds for the Express server to come up
for _ in $(seq 1 30); do
  if curl -sf http://localhost:3000/health > /dev/null 2>&1; then break; fi
  sleep 1
done

curl -sf http://localhost:5173 > /dev/null && curl -sf http://localhost:3000/health > /dev/null

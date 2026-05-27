# BUG: smoke-test.sh orphans child processes and uses fragile fixed sleep

**Severity:** LOW
**File(s):** checks/smoke-test.sh

## Problem

`checks/smoke-test.sh` starts `pnpm dev &` and captures `$!` as `DEV_PID`. That PID is the **pnpm** process, not the underlying Vite/Node child processes that pnpm spawns. `kill "$DEV_PID"` only signals pnpm — the spawned children (vite dev server, any node servers) are not signaled and can be reparented to PID 1, holding ports 5173/3000 open and leaking processes between runs.

Additional issues in the same script:
1. **Fixed 5-second sleep** before probing — on a cold machine or slow CI, Vite may need longer to come up, producing flaky false negatives.
2. `set -uo pipefail` without `set -e` — line-by-line failures (e.g., `pnpm dev` failing to launch) don't propagate. Combined with `2>/dev/null` masking, the script can return non-deterministic results.
3. `curl ... || curl ...` — any single endpoint responding is sufficient. Once both client and server are expected to run, this hides regressions in either one (see review-1.md).

## Expected

Per Constitution rule 8 (PID-safe process management): *"Kill only tracked PIDs. Never `pkill -f` broadly. Use PID files for safe emergency stop."* The script tracks only the pnpm PID, but should track and clean up the actual process group it spawned.

A smoke test should also poll for readiness rather than rely on a fixed sleep.

## Fix

1. Start the dev process in its own process group and signal the whole group on cleanup:
   ```bash
   set -euo pipefail
   trap 'kill -- -"$DEV_PGID" 2>/dev/null || true' EXIT
   set -m  # enable job control so the child gets its own process group
   pnpm dev &
   DEV_PID=$!
   DEV_PGID=$DEV_PID
   ```
2. Replace `sleep 5` with a bounded poll (e.g., up to ~20s):
   ```bash
   for _ in $(seq 1 20); do
     if curl -sf http://localhost:5173 > /dev/null 2>&1; then break; fi
     sleep 1
   done
   ```
3. Once review-1.md is addressed and both client+server come up, AND the two endpoint checks so a regression in either fails:
   ```bash
   curl -sf http://localhost:5173 > /dev/null && curl -sf http://localhost:3000/health > /dev/null
   ```

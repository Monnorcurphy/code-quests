#!/usr/bin/env bash
# dep-audit.sh — Detect package manager and run dependency audit.
# Exits 1 if HIGH or CRITICAL vulnerabilities are found, 0 otherwise.
# If no package manager is detected, exits 0 (skip).

set -euo pipefail

if [ -f pnpm-lock.yaml ]; then
  echo "Detected pnpm — running pnpm audit --audit-level=high"
  pnpm audit --audit-level=high
elif [ -f yarn.lock ]; then
  echo "Detected yarn — running yarn audit --level high"
  yarn audit --level high
elif [ -f package-lock.json ]; then
  echo "Detected npm — running npm audit --audit-level=high"
  npm audit --audit-level=high
else
  echo "No package manager lock file detected — skipping dependency audit"
  exit 0
fi

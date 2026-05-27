#!/bin/bash
# core/scripts/factory-doctor.sh — Preflight checks for factory readiness
# Usage: ./core/scripts/factory-doctor.sh
#
# Verifies: git clean, required tools present, profile exists, dirs writable

set -uo pipefail

PASS=0
FAIL=0
WARN=0

pass() { echo "  ✅ $1"; ((PASS++)); }
fail() { echo "  ❌ $1"; ((FAIL++)); }
warn() { echo "  ⚠️  $1"; ((WARN++)); }

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║     FACTORY DOCTOR — PREFLIGHT CHECK          ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── Git ──
echo "── Git ─────────────────────────────────────────"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    pass "Inside git repo"
else
    fail "Not inside a git repo"
fi

if git diff --quiet 2>/dev/null; then
    pass "Worktree clean"
else
    fail "Worktree dirty — commit or stash before running factory"
fi

if git remote get-url origin >/dev/null 2>&1; then
    pass "Remote 'origin' configured"
else
    warn "No remote 'origin' — PRs will fail"
fi

# ── Tools ──
echo ""
echo "── Required Tools ──────────────────────────────"
for tool in git gh; do
    if command -v "$tool" >/dev/null 2>&1; then
        pass "$tool installed"
    else
        fail "$tool NOT found"
    fi
done

# ── Optional Tools (from profile) ──
echo ""
echo "── Profile Tools ─────────────────────────────"
if [ -f "factory/profile.yaml" ]; then
    pass "factory/profile.yaml exists"

    # Check common tools that profiles might reference
    for tool in node pnpm npm cargo rustc python3; do
        if command -v "$tool" >/dev/null 2>&1; then
            pass "$tool available"
        else
            warn "$tool not found (may be needed by profile)"
        fi
    done
else
    warn "No factory/profile.yaml — using minimal defaults"
fi

# ── Directories ──
echo ""
echo "── Directories ─────────────────────────────────"
for dir in metrics specs/bugs specs/done incidents; do
    mkdir -p "$dir" 2>/dev/null
    if [ -d "$dir" ]; then
        pass "$dir/ writable"
    else
        fail "$dir/ cannot be created"
    fi
done

# ── Claude Code ──
echo ""
echo "── Claude Code ─────────────────────────────────"
if command -v claude >/dev/null 2>&1; then
    pass "claude CLI installed"
else
    fail "claude CLI NOT found — factory cannot run agents"
fi

# ── Results ──
echo ""
echo "══════════════════════════════════════════════"
echo "  RESULTS: ✅ ${PASS} pass | ❌ ${FAIL} fail | ⚠️  ${WARN} warn"
echo "══════════════════════════════════════════════"
echo ""

if [ ${FAIL} -gt 0 ]; then
    echo "  ❌ Factory is NOT ready. Fix failures above before running."
    exit 1
else
    echo "  ✅ Factory is ready."
    exit 0
fi

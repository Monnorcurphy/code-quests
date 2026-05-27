#!/bin/bash
# core/scripts/verify.sh — Tech-agnostic verification framework (Hard/Warn split)
# Usage: ./scripts/verify.sh
#
# Reads factory/profile.yaml (if present) to determine which commands to run.
# Falls back to universal checks only if no profile exists.
#
# Exit codes:
#   0 — All HARD checks passed (WARN issues may exist)
#   1 — At least one HARD check failed
#
# Policy:
#   HARD FAIL: build, test, typecheck, secrets (blocks the line)
#   WARN:      lint, debug prints, style checks (proceeds to review/fix)
#   SKIP:      check not applicable

set -uo pipefail

TIMESTAMP=$(date +%Y-%m-%d_%H-%M)
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
COMMIT=$(git log -1 --oneline 2>/dev/null || echo "unknown")

PASS=0
FAIL=0
WARN_COUNT=0
SKIP=0

REPORT=""

header()  { REPORT+="$1"$'\n'; }
pass()    { REPORT+="  $1  ✅ PASS"$'\n'; ((PASS++)); }
fail()    { REPORT+="  $1  ❌ HARD FAIL"$'\n'; ((FAIL++)); }
warn_it() { REPORT+="  $1  ⚠️  WARN"$'\n'; ((WARN_COUNT++)); }
skip()    { REPORT+="  $1  ⏭️  SKIP ($2)"$'\n'; ((SKIP++)); }

header ""
header "╔══════════════════════════════════════════════╗"
header "║     DARK FACTORY — VERIFICATION REPORT        ║"
header "╚══════════════════════════════════════════════╝"
header ""
header "  ${TIMESTAMP}"
header "  Branch: ${BRANCH}"
header "  Commit: ${COMMIT}"

# ══════════════════════════════════════════
# UNIVERSAL CHECKS (always run, any stack)
# ══════════════════════════════════════════
header ""
header "── Universal Checks ──────────────────────────"

# Git clean check
if git diff --quiet 2>/dev/null; then
    pass "Git worktree clean..."
else
    # Not a failure — builder may have uncommitted work
    warn_it "Git worktree has uncommitted changes..."
fi

# No hardcoded secrets (HARD)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -x "${SCRIPT_DIR}/../../checks/no-secrets.sh" ]; then
    if "${SCRIPT_DIR}/../../checks/no-secrets.sh"; then
        pass "No hardcoded secrets..."
    else
        fail "No hardcoded secrets..."
    fi
else
    # Inline fallback
    if ! grep -rn 'sk-\|AKIA\|api_key\s*=\|SECRET_KEY\|PRIVATE_KEY' --include="*.ts" --include="*.rs" --include="*.py" --include="*.js" --include="*.go" --include="*.java" . 2>/dev/null | grep -v test | grep -v node_modules | grep -v target | grep -v '.git' | grep -v '/dist/' > /dev/null 2>&1; then
        pass "No hardcoded secrets..."
    else
        fail "No hardcoded secrets..."
    fi
fi

# ══════════════════════════════════════════
# PROFILE-BASED CHECKS
# ══════════════════════════════════════════
PROFILE="factory/profile.yaml"

if [ -f "${PROFILE}" ]; then
    header ""
    header "── Profile Checks ────────────────────────────"

    # Parse profile commands (simple yaml key: value extraction)
    get_profile_val() {
        grep "^${1}:" "${PROFILE}" 2>/dev/null | sed "s/^${1}:[[:space:]]*//" | tr -d '"' | tr -d "'"
    }

    # Validate that a profile command does not contain shell metacharacters
    # that could allow arbitrary code execution (command injection).
    validate_profile_cmd() {
        local cmd="$1"
        local label="${2:-command}"
        if echo "$cmd" | grep -qE '[;|&`$()]'; then
            echo "  SECURITY: Unsafe characters in profile ${label}: ${cmd}"
            return 1
        fi
        return 0
    }

    BUILD_CMD=$(get_profile_val "build")
    TEST_CMD=$(get_profile_val "test")
    TYPECHECK_CMD=$(get_profile_val "typecheck")
    LINT_CMD=$(get_profile_val "lint")
    INSTALL_CMD=$(get_profile_val "install")

    # Parse checks list from profile (if present)
    # Format: checks:\n  - check-name\n  - check-name
    PROFILE_CHECKS=""
    if grep -q "^checks:" "${PROFILE}" 2>/dev/null; then
        PROFILE_CHECKS=$(grep "^  - " "${PROFILE}" | sed 's/^  - //' | tr -d ' ')
    fi

    # Helper: check if a specific check is in the profile's allowed list
    check_allowed() {
        local check_name="$1"
        # If no checks list in profile, all checks run (backward compatible)
        [ -z "${PROFILE_CHECKS}" ] && return 0
        echo "${PROFILE_CHECKS}" | grep -q "^${check_name}$"
    }

    # Install dependencies (skip if already done)
    if [ -n "${INSTALL_CMD}" ]; then
        # Detect common dep directories
        DEPS_PRESENT="no"
        [ -d "node_modules" ] && DEPS_PRESENT="yes"
        [ -d "target" ] && DEPS_PRESENT="yes"
        [ -d "venv" ] && DEPS_PRESENT="yes"
        [ -d ".venv" ] && DEPS_PRESENT="yes"

        if [ "${DEPS_PRESENT}" = "yes" ]; then
            skip "Install deps..." "dependencies already present"
        else
            if validate_profile_cmd "${INSTALL_CMD}" "install"; then
                if bash -c "${INSTALL_CMD}" 2>/dev/null; then
                    pass "Install deps..."
                else
                    fail "Install deps..."
                fi
            else
                fail "Install deps (unsafe command rejected)..."
            fi
        fi
    fi

    # Build (HARD)
    if [ -n "${BUILD_CMD}" ]; then
        if validate_profile_cmd "${BUILD_CMD}" "build"; then
            if bash -c "${BUILD_CMD}" 2>/dev/null; then
                pass "Build..."
            else
                fail "Build..."
            fi
        else
            fail "Build (unsafe command rejected)..."
        fi
    else
        skip "Build..." "no build command in profile"
    fi

    # Test (HARD)
    if [ -n "${TEST_CMD}" ]; then
        if validate_profile_cmd "${TEST_CMD}" "test"; then
            if bash -c "${TEST_CMD}" 2>/dev/null; then
                pass "Test..."
            else
                fail "Test..."
            fi
        else
            fail "Test (unsafe command rejected)..."
        fi
    else
        skip "Test..." "no test command in profile"
    fi

    # Typecheck (HARD)
    if [ -n "${TYPECHECK_CMD}" ]; then
        if validate_profile_cmd "${TYPECHECK_CMD}" "typecheck"; then
            if bash -c "${TYPECHECK_CMD}" 2>/dev/null; then
                pass "Typecheck..."
            else
                fail "Typecheck..."
            fi
        else
            fail "Typecheck (unsafe command rejected)..."
        fi
    else
        skip "Typecheck..." "no typecheck command in profile"
    fi

    # Lint (WARN)
    if [ -n "${LINT_CMD}" ]; then
        if validate_profile_cmd "${LINT_CMD}" "lint"; then
            if bash -c "${LINT_CMD}" 2>/dev/null; then
                pass "Lint..."
            else
                warn_it "Lint..."
            fi
        else
            warn_it "Lint (unsafe command rejected)..."
        fi
    else
        skip "Lint..." "no lint command in profile"
    fi

    # Smoke test (HARD — app must start and survive briefly)
    SMOKE_CMD=$(get_profile_val "smoke_test")
    if [ -n "${SMOKE_CMD}" ]; then
        if validate_profile_cmd "${SMOKE_CMD}" "smoke_test"; then
            if bash -c "${SMOKE_CMD}" 2>/dev/null; then
                pass "Smoke test..."
            else
                fail "Smoke test..."
            fi
        else
            fail "Smoke test (unsafe command rejected)..."
        fi
    else
        skip "Smoke test..." "no smoke_test command in profile"
    fi
else
    header ""
    header "── Profile ───────────────────────────────────"
    skip "Profile checks..." "no factory/profile.yaml found"
    header "  (running universal checks only)"
fi

# ══════════════════════════════════════════
# DEBUG PRINT CHECK (WARN)
# ══════════════════════════════════════════
header ""
header "── Code Quality ──────────────────────────────"

# Binary asset validation (HARD — corrupt icons crash apps silently)
if check_allowed "binary-assets" && [ -x "${SCRIPT_DIR}/../../checks/binary-assets.sh" ]; then
    if "${SCRIPT_DIR}/../../checks/binary-assets.sh" . > /dev/null 2>&1; then
        pass "Binary assets valid..."
    else
        fail "Binary assets valid..."
        "${SCRIPT_DIR}/../../checks/binary-assets.sh" . 2>/dev/null | head -10
    fi
elif ! check_allowed "binary-assets"; then
    skip "Binary assets..." "not in profile checks list"
else
    skip "Binary assets..." "checks/binary-assets.sh not found"
fi

# Cross-boundary enum check (WARN — surfaces constraints for reviewer)
if check_allowed "cross-boundary" && [ -x "${SCRIPT_DIR}/../../checks/cross-boundary.sh" ]; then
    CROSS_OUTPUT=$("${SCRIPT_DIR}/../../checks/cross-boundary.sh" . 2>/dev/null)
    if [ -n "${CROSS_OUTPUT}" ]; then
        warn_it "Cross-boundary constraints found (reviewer should verify)..."
        header "$(echo "${CROSS_OUTPUT}" | head -20)"
    else
        pass "No cross-boundary constraints to check..."
    fi
elif ! check_allowed "cross-boundary"; then
    skip "Cross-boundary..." "not in profile checks list"
fi

# Check for common debug prints (configurable per profile later)
DEBUG_PATTERNS='console\.log\|print(\|println!\|fmt\.Print\|System\.out\.print\|DISPLAY'
if ! grep -rn "${DEBUG_PATTERNS}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.rs" --include="*.py" --include="*.go" --include="*.java" . 2>/dev/null | grep -v test | grep -v node_modules | grep -v target | grep -v '.git' | grep -v '.test.' > /dev/null 2>&1; then
    pass "No debug prints in prod code..."
else
    warn_it "No debug prints in prod code..."
fi

# Contrast class ban (HARD — single largest bug category: 25+ instances across projects)
if check_allowed "contrast-classes" && [ -x "${SCRIPT_DIR}/../../checks/contrast-classes.sh" ]; then
    if "${SCRIPT_DIR}/../../checks/contrast-classes.sh" . > /dev/null 2>&1; then
        pass "No banned low-contrast classes..."
    else
        fail "No banned low-contrast classes..."
        "${SCRIPT_DIR}/../../checks/contrast-classes.sh" . 2>/dev/null | head -10
    fi
elif ! check_allowed "contrast-classes"; then
    skip "Low-contrast classes..." "not in profile checks list"
fi

# Error handling hygiene (WARN — empty catch blocks, discarded Results)
if check_allowed "error-handling" && [ -x "${SCRIPT_DIR}/../../checks/error-handling.sh" ]; then
    if "${SCRIPT_DIR}/../../checks/error-handling.sh" . > /dev/null 2>&1; then
        pass "Error handling hygiene..."
    else
        warn_it "Error handling hygiene..."
        "${SCRIPT_DIR}/../../checks/error-handling.sh" . 2>/dev/null | head -5
    fi
elif ! check_allowed "error-handling"; then
    skip "Error handling..." "not in profile checks list"
fi

# Conditional test assertions (WARN — tests that silently skip assertions)
if check_allowed "conditional-assertions" && [ -x "${SCRIPT_DIR}/../../checks/conditional-assertions.sh" ]; then
    if "${SCRIPT_DIR}/../../checks/conditional-assertions.sh" . > /dev/null 2>&1; then
        pass "No conditional test assertions..."
    else
        warn_it "No conditional test assertions..."
    fi
elif ! check_allowed "conditional-assertions"; then
    skip "Conditional assertions..." "not in profile checks list"
fi

# Serde hygiene for LLM structs (WARN — missing #[serde(default)] on Deserialize structs)
if check_allowed "serde-hygiene" && [ -x "${SCRIPT_DIR}/../../checks/serde-hygiene.sh" ]; then
    if "${SCRIPT_DIR}/../../checks/serde-hygiene.sh" . > /dev/null 2>&1; then
        pass "Serde hygiene (LLM structs)..."
    else
        warn_it "Serde hygiene (LLM structs)..."
    fi
elif ! check_allowed "serde-hygiene"; then
    skip "Serde hygiene..." "not in profile checks list"
fi

# SQLite FK pragma enforcement (HARD — missing pragma silently disables ALL FK constraints)
if check_allowed "fk-pragma" && [ -x "${SCRIPT_DIR}/../../checks/fk-pragma.sh" ]; then
    if "${SCRIPT_DIR}/../../checks/fk-pragma.sh" . > /dev/null 2>&1; then
        pass "SQLite FK pragma..."
    else
        fail "SQLite FK pragma..."
        "${SCRIPT_DIR}/../../checks/fk-pragma.sh" . 2>/dev/null | head -5
    fi
elif ! check_allowed "fk-pragma"; then
    skip "SQLite FK pragma..." "not in profile checks list"
fi

# ── Security Checks ──
header ""
header "── Security ──────────────────────────────────"

# No eval() with variable interpolation (WARN — intentional eval exists in verify.sh itself)
if check_allowed "no-eval" && [ -x "${SCRIPT_DIR}/../../checks/no-eval.sh" ]; then
    if "${SCRIPT_DIR}/../../checks/no-eval.sh" . > /dev/null 2>&1; then
        pass "No unsafe eval patterns..."
    else
        warn_it "Unsafe eval patterns found..."
    fi
elif ! check_allowed "no-eval"; then
    skip "No eval..." "not in profile checks list"
fi

# Input validation: XSS, SQL injection, selector injection (HARD)
if check_allowed "input-validation" && [ -x "${SCRIPT_DIR}/../../checks/input-validation.sh" ]; then
    if "${SCRIPT_DIR}/../../checks/input-validation.sh" . > /dev/null 2>&1; then
        pass "Input validation patterns..."
    else
        fail "Input validation issues found..."
        "${SCRIPT_DIR}/../../checks/input-validation.sh" . 2>/dev/null | head -5
    fi
elif ! check_allowed "input-validation"; then
    skip "Input validation..." "not in profile checks list"
fi

# Prompt injection boundaries (WARN — heuristic check for content boundaries)
if check_allowed "prompt-injection" && [ -x "${SCRIPT_DIR}/../../checks/prompt-injection.sh" ]; then
    if "${SCRIPT_DIR}/../../checks/prompt-injection.sh" . > /dev/null 2>&1; then
        pass "Prompt injection boundaries..."
    else
        warn_it "Prompt injection risk (missing content boundaries)..."
    fi
elif ! check_allowed "prompt-injection"; then
    skip "Prompt injection..." "not in profile checks list"
fi

# Semgrep SAST scan (HIGH/CRITICAL = HARD, MEDIUM/LOW = WARN)
if check_allowed "semgrep" && [ -x "${SCRIPT_DIR}/../../checks/semgrep.sh" ]; then
    SEMGREP_OUTPUT=$("${SCRIPT_DIR}/../../checks/semgrep.sh" . 2>/dev/null)
    SEMGREP_RC=$?
    if [ ${SEMGREP_RC} -eq 0 ]; then
        if echo "${SEMGREP_OUTPUT}" | grep -q "WARN\|MEDIUM\|LOW\|warning"; then
            warn_it "Semgrep SAST (medium/low findings)..."
            header "$(echo "${SEMGREP_OUTPUT}" | head -20)"
        else
            pass "Semgrep SAST..."
        fi
    else
        fail "Semgrep SAST (high/critical findings)..."
        header "$(echo "${SEMGREP_OUTPUT}" | head -20)"
    fi
elif ! check_allowed "semgrep"; then
    skip "Semgrep SAST..." "not in profile checks list"
else
    skip "Semgrep SAST..." "checks/semgrep.sh not found"
fi

# ── Results ──
header ""
header "══════════════════════════════════════════════"
header "  RESULTS: ✅ ${PASS} passed | ❌ ${FAIL} hard fail | ⚠️  ${WARN_COUNT} warn | ⏭️  ${SKIP} skipped"
header "══════════════════════════════════════════════"

echo "$REPORT"

mkdir -p metrics
REPORT_FILE="metrics/verify-${TIMESTAMP}.txt"
echo "$REPORT" > "${REPORT_FILE}"
echo ""
echo "  Report saved to: ${REPORT_FILE}"

# Exit with failure only on HARD fails
[ ${FAIL} -eq 0 ]

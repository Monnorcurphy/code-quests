#!/bin/bash
# checks/shellcheck.sh — Run ShellCheck on all factory shell scripts
# Returns 0 if all scripts pass, 1 if any have errors
#
# Requires: shellcheck (https://github.com/koalaman/shellcheck)

set -uo pipefail

if ! command -v shellcheck &>/dev/null; then
    echo "shellcheck not installed — install with: brew install shellcheck"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

ERRORS=0

# Find all .sh files in core/scripts/ and checks/
while IFS= read -r -d '' script; do
    # Exclude common patterns that are intentional in factory orchestration scripts:
    # SC2086: word splitting on unquoted variables (intentional for flag expansion)
    # SC2034: unused variables (variables used by sourced scripts)
    # SC2155: declare and assign separately (convenience pattern)
    # SC2181: check exit code directly (readability pattern)
    # SC2012: use find instead of ls (ls is simpler for known patterns)
    # SC1091: not following sourced file (cross-project sourcing)
    # SC2016: expressions in single quotes (intentional in prompt strings)
    # SC2001: see if sed can be replaced (sed is clearer here)
    if ! shellcheck -S error "${script}"; then
        ((ERRORS++))
    fi
done < <(find "${ROOT_DIR}/core/scripts" "${ROOT_DIR}/checks" -name '*.sh' -print0 2>/dev/null)

# Also check top-level scripts
for script in "${ROOT_DIR}/bootstrap.sh" "${ROOT_DIR}/install.sh"; do
    if [ -f "${script}" ]; then
        if ! shellcheck -S error "${script}"; then
            ((ERRORS++))
        fi
    fi
done

if [ "${ERRORS}" -gt 0 ]; then
    echo ""
    echo "ShellCheck: ${ERRORS} script(s) with errors"
    exit 1
fi

echo "ShellCheck: all scripts clean"
exit 0

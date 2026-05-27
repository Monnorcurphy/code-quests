#!/bin/bash
# checks/file-size.sh — Enforce per-language file size limits
# Usage: ./checks/file-size.sh [search-path]
# Exit 0 if all files within limits, 1 if violations found
#
# Per-language limits based on industry best practices:
#   - Smaller limits for languages that favor small modules (Python, Shell, Svelte)
#   - Larger limits for verbose languages (Java, C/C++) and those with
#     explicit error handling (Rust, Go)
#   - Test files get 2x the source limit
#   - Generated/vendored files are excluded
#
# Exemptions: list files in factory/file-size-exemptions.txt (one per line)
# Lines starting with # are comments. Paths are relative to repo root.
#
# Example factory/file-size-exemptions.txt:
#   # Contract test suite — inherently large
#   src/tests/contract.test.ts
#   # Generated protobuf bindings
#   src/generated/api.rs

SEARCH_PATH="${1:-.}"
VIOLATIONS=0
CHECKED=0

EXCLUDE_DIRS=(
    .git node_modules target dist build vendor
    __pycache__ .venv venv .next coverage migrations
    site-packages .tox .eggs
    projects ui adversarial-tests
)

# ── Per-language limits (source / test) ──────────────────────────────
# Format: extension:source_limit:test_limit
LANG_LIMITS=(
    # TypeScript / JavaScript — favor small, focused modules
    "ts:400:800"
    "tsx:300:600"
    "js:400:800"
    "jsx:300:600"
    "mjs:400:800"
    "svelte:300:600"
    "vue:300:600"

    # Rust — explicit error handling + match arms inflate line counts
    "rs:500:1000"

    # Go — explicit error handling, no generics (pre-1.18)
    "go:500:1000"

    # Python — PEP 8 culture favors small modules
    "py:400:800"

    # Java — verbose by nature (boilerplate, annotations)
    "java:600:1200"
    "kt:500:1000"

    # C / C++ — headers + implementations, can be longer
    "c:600:1200"
    "h:400:800"
    "cpp:600:1200"
    "hpp:400:800"

    # Shell — should be small and composable
    "sh:300:600"
    "bash:300:600"
    "zsh:300:600"

    # CSS / Styles — component-scoped should be small
    "css:400:800"
    "scss:400:800"

    # SQL
    "sql:300:600"

    # Ruby
    "rb:400:800"

    # Swift
    "swift:500:1000"

    # Dart / Flutter
    "dart:400:800"

    # Elixir / Erlang
    "ex:400:800"
    "exs:400:800"

    # PHP
    "php:500:1000"

    # COBOL — inherently verbose
    "cbl:800:1600"
    "cob:800:1600"
)

# ── Load exemptions ──────────────────────────────────────────────────
EXEMPTIONS_FILE="${SEARCH_PATH}/factory/file-size-exemptions.txt"
declare -a EXEMPT_FILES=()
if [ -f "${EXEMPTIONS_FILE}" ]; then
    while IFS= read -r line; do
        # Skip comments and blank lines
        line=$(echo "${line}" | sed 's/#.*//' | xargs)
        if [ -n "${line}" ]; then
            EXEMPT_FILES+=("${line}")
        fi
    done < "${EXEMPTIONS_FILE}"
fi

is_exempt() {
    local file="$1"
    # Strip leading ./ and search path prefix for comparison
    file="${file#./}"
    file="${file#${SEARCH_PATH}/}"
    file="${file#${SEARCH_PATH}}"
    file="${file#/}"
    for exempt in "${EXEMPT_FILES[@]}"; do
        if [ "${file}" = "${exempt}" ]; then
            return 0
        fi
    done
    return 1
}

# ── Detect if a file is a test file ──────────────────────────────────
is_test_file() {
    local file="$1"
    case "${file}" in
        *.test.*|*.spec.*|*_test.*|*_spec.*|*/test_*|*/tests/*|*/__tests__/*|*/test/*|*_test.go)
            return 0 ;;
        *)
            return 1 ;;
    esac
}

# ── Get limit for extension ──────────────────────────────────────────
get_limit() {
    local ext="$1"
    local is_test="$2"
    for entry in "${LANG_LIMITS[@]}"; do
        local e="${entry%%:*}"
        if [ "${e}" = "${ext}" ]; then
            local rest="${entry#*:}"
            local src_limit="${rest%%:*}"
            local test_limit="${rest#*:}"
            if [ "${is_test}" = "yes" ]; then
                echo "${test_limit}"
            else
                echo "${src_limit}"
            fi
            return
        fi
    done
    echo "500"  # default
}

# ── Build find command as an array (no eval) ─────────────────────────
FIND_CMD=( find "${SEARCH_PATH}" )

# Add prune rules for excluded directories
FIND_CMD+=( "(" )
first=true
for dir in "${EXCLUDE_DIRS[@]}"; do
    if [ "${first}" = true ]; then
        first=false
    else
        FIND_CMD+=( -o )
    fi
    FIND_CMD+=( -name "${dir}" -type d )
done
FIND_CMD+=( ")" -prune -o )

# Add file extension matches
FIND_CMD+=( -type f "(" )
first=true
for entry in "${LANG_LIMITS[@]}"; do
    ext="${entry%%:*}"
    if [ "${first}" = true ]; then
        first=false
    else
        FIND_CMD+=( -o )
    fi
    FIND_CMD+=( -name "*.${ext}" )
done
FIND_CMD+=( ")" -print0 )

# ── Main scan ────────────────────────────────────────────────────────
VIOLATION_LIST=""

while IFS= read -r -d '' file; do
    # Get extension
    filename=$(basename "${file}")
    ext="${filename##*.}"

    # Skip exempted files
    if is_exempt "${file}"; then
        continue
    fi

    # Determine if test
    if is_test_file "${file}"; then
        IS_TEST="yes"
    else
        IS_TEST="no"
    fi

    LIMIT=$(get_limit "${ext}" "${IS_TEST}")
    LINES=$(wc -l < "${file}" 2>/dev/null | tr -d ' ')

    ((CHECKED++))

    if [ "${LINES}" -gt "${LIMIT}" ]; then
        ((VIOLATIONS++))
        TYPE_LABEL="source"
        if [ "${IS_TEST}" = "yes" ]; then
            TYPE_LABEL="test"
        fi
        REL_PATH="${file#${SEARCH_PATH}/}"
        REL_PATH="${REL_PATH#./}"
        VIOLATION_LIST+="  ${LINES} lines (limit: ${LIMIT}, ${TYPE_LABEL})  ${REL_PATH}"$'\n'
    fi
done < <("${FIND_CMD[@]}" 2>/dev/null)

if [ "${VIOLATIONS}" -gt 0 ]; then
    echo "❌ ${VIOLATIONS} file(s) exceed size limits (${CHECKED} checked):"
    echo ""
    # Sort by line count descending
    echo "${VIOLATION_LIST}" | sort -rn | head -20
    echo ""
    echo "To exempt a file, add it to factory/file-size-exemptions.txt"
    exit 1
fi

exit 0

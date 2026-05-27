#!/bin/bash
# checks/serde-hygiene.sh — Ensure Rust Deserialize structs use #[serde(default)]
# Usage: ./checks/serde-hygiene.sh [search-path]
#
# LLMs are unreliable serializers — they routinely omit fields, return wrong
# types, or produce partial JSON. Any struct deserializing LLM output must
# use #[serde(default)] on fields so missing data doesn't crash the app.
#
# Heuristic: files containing `Deserialize` should also contain `serde(default)`.
# Scoped to llm/ and commands/ directories where LLM output is parsed.
#
# Exit 0 if clean, 1 if violations found

SEARCH_PATH="${1:-.}"
MISSING=0
MISSING_FILES=""

# Find Rust files with Deserialize in likely LLM-adjacent directories
LLM_DIRS=$(find "${SEARCH_PATH}" -type d \( -name "llm" -o -name "commands" -o -name "ai" -o -name "inference" \) \
    -not -path "*/node_modules/*" -not -path "*/target/*" -not -path "*/.git/*" 2>/dev/null)

if [ -z "${LLM_DIRS}" ]; then
    exit 0
fi

for DIR in ${LLM_DIRS}; do
    FILES=$(grep -rl 'Deserialize' "${DIR}" --include="*.rs" 2>/dev/null || true)
    for FILE in ${FILES}; do
        HAS_DEFAULT=$(grep -c 'serde(default)' "${FILE}" 2>/dev/null || echo 0)
        if [ "${HAS_DEFAULT}" -eq 0 ]; then
            MISSING=$((MISSING + 1))
            MISSING_FILES="${MISSING_FILES}\n  ${FILE}"
        fi
    done
done

if [ "${MISSING}" -gt 0 ]; then
    echo "⚠️  Found ${MISSING} file(s) with Deserialize but no #[serde(default)]:"
    echo -e "${MISSING_FILES}"
    echo ""
    echo "Fix: add #[serde(default)] to struct fields that deserialize LLM output"
    exit 1
fi

exit 0

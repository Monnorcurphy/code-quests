#!/bin/bash
# core/scripts/lib.sh — Shared helpers for codename-based task resolution
#
# Source this file from pipeline scripts:
#   source "$(dirname "$0")/lib.sh"
#
# All functions assume the working directory is the repo root.
# This is the Dark Factory generic version — no project-specific paths.

# Validate that an identifier (task ID, codename, phase number) contains only
# safe characters. Rejects shell metacharacters, path traversal, and injection.
# Usage: validate_identifier <value> [label]
# Returns 0 if safe, exits 1 if unsafe.
validate_identifier() {
    local id="$1"
    local label="${2:-identifier}"
    if [ -z "$id" ]; then
        echo "Empty ${label}"
        exit 1
    fi
    if ! echo "$id" | grep -qE '^[a-z0-9][a-z0-9._-]*$'; then
        echo "Invalid ${label}: '${id}' — must be lowercase alphanumeric, dots, hyphens, underscores only"
        exit 1
    fi
}

# Escape a string for use in a sed pattern (search position)
# Usage: sed_escape_pattern <string>
sed_escape_pattern() {
    printf '%s' "$1" | sed 's/[.[\/*^$(){}?+|\\]/\\&/g'
}

# Escape a string for use in a sed replacement
# Usage: sed_escape_replacement <string>
sed_escape_replacement() {
    printf '%s' "$1" | sed 's/[&/\\]/\\&/g'
}

# Format a phase number as a zero-padded directory name
# Usage: phase_dir_name <phase_num>
# Prints: specs/phase-03 (for input "3" or "03")
phase_dir_name() {
    printf 'specs/phase-%02d' "$1"
}

# Check if a task ID is a codename (alphabetic) vs numeric (X.NNNNN)
is_codename() {
    local ID="$1"
    [[ ! "$ID" =~ ^[0-9]+\.[0-9]+$ ]]
}

# Find which phase a codename belongs to
# Usage: resolve_phase <codename>
# Prints phase number (without leading zeros), returns 0 on success
resolve_phase() {
    local CODENAME="$1"
    local SEQ_FILE
    for SEQ_FILE in specs/phase-*/sequence.md; do
        [ -f "${SEQ_FILE}" ] || continue
        if grep -q "^${CODENAME}[[:space:]]" "${SEQ_FILE}" 2>/dev/null; then
            # Strip leading zeros to prevent octal interpretation in bash arithmetic
            local RAW
            RAW=$(echo "${SEQ_FILE}" | sed -E 's|specs/phase-0*([0-9]+)/sequence.md|\1|')
            echo "${RAW}"
            return 0
        fi
    done
    return 1
}

# Get the spec file path for a codename
# Usage: resolve_spec <codename> <phase>
# Prints: specs/phase-N/task-codename-description.md
resolve_spec() {
    local CODENAME="$1"
    local PHASE="$2"
    local PHASE_DIR
    PHASE_DIR=$(phase_dir_name "${PHASE}")
    local SEQ_FILE="${PHASE_DIR}/sequence.md"
    local SPEC_NAME
    SPEC_NAME=$(grep "^${CODENAME}[[:space:]]" "${SEQ_FILE}" 2>/dev/null | awk '{print $2}')
    if [ -n "${SPEC_NAME}" ]; then
        echo "${PHASE_DIR}/${SPEC_NAME}"
    fi
}

# Get ordered list of task codenames for a phase (from sequence.md)
# Usage: phase_tasks <phase>
# Prints one codename per line in execution order
phase_tasks() {
    local PHASE="$1"
    local SEQ_FILE="$(phase_dir_name "${PHASE}")/sequence.md"
    if [ -f "${SEQ_FILE}" ]; then
        grep -v '^#' "${SEQ_FILE}" | grep -v '^[[:space:]]*$' | awk '{print $1}'
    fi
}

# Get the previous task in a phase's sequence
# Usage: prev_task <codename> <phase>
# Prints the predecessor codename (empty if first task)
prev_task() {
    local CODENAME="$1"
    local PHASE="$2"
    phase_tasks "${PHASE}" | awk -v cur="${CODENAME}" \
        '$0 == cur {found=1; exit} {prev=$0} END {if (found) print prev}'
}

# Get the next task in a phase's sequence
# Usage: next_task <codename> <phase>
# Prints the successor codename (empty if last task)
next_task() {
    local CODENAME="$1"
    local PHASE="$2"
    phase_tasks "${PHASE}" | awk -v cur="${CODENAME}" \
        'found {print; exit} $0 == cur {found=1}'
}

# Branch name for a task codename
# Usage: task_branch <codename>
task_branch() {
    echo "feature/$1"
}

# Last task codename of a phase
# Usage: last_task <phase>
last_task() {
    phase_tasks "$1" | tail -1
}

# Count of tasks in a phase
# Usage: task_count <phase>
task_count() {
    phase_tasks "$1" | wc -l | tr -d ' '
}

# Get 1-based position of a task in its phase's sequence
# Usage: task_position <codename> <phase>
# Prints the position number (empty if not found)
task_position() {
    local CODENAME="$1"
    local PHASE="$2"
    phase_tasks "${PHASE}" | awk -v cur="${CODENAME}" \
        '{n++; if ($0 == cur) {print n; exit}}'
}

# Get the "touches" column for a codename from sequence.md
# Usage: task_touches <codename> <phase>
# Prints the touches value (e.g., backend, frontend, all)
# Returns "all" if codename not found or column missing
task_touches() {
    local CODENAME="$1"
    local PHASE="$2"
    local SEQ_FILE="$(phase_dir_name "${PHASE}")/sequence.md"
    local TOUCHES
    TOUCHES=$(grep "^${CODENAME}[[:space:]]" "${SEQ_FILE}" 2>/dev/null | awk '{print $NF}')
    if [ -z "${TOUCHES}" ]; then
        echo "all"
    else
        echo "${TOUCHES}"
    fi
}

# Check if a phase has a sequence.md (codename mode)
has_sequence() {
    local PHASE="$1"
    [ -f "$(phase_dir_name "${PHASE}")/sequence.md" ]
}

# Generate MD5 fingerprints for key files that builders frequently re-read.
# Used to detect unchanged files across consecutive tasks in a phase.
#
# Key files are discovered from profile.yaml's "key_files" list, or if
# not configured, from common framework files in the repo.
#
# Usage: fingerprint_key_files [output_file]
# Output: a markdown table of file paths and their MD5 hashes
fingerprint_key_files() {
    local OUTPUT="${1:-metrics/file-fingerprints.md}"
    mkdir -p "$(dirname "${OUTPUT}")"
    {
        echo "# Key File Fingerprints (auto-generated)"
        echo "# If a hash matches the previous task, the file is UNCHANGED — do not re-read it."
        echo ""
        echo "| File | MD5 |"
        echo "|------|-----|"
    } > "${OUTPUT}"

    local FILES=()

    # Try profile.yaml key_files list first
    if [ -f "factory/profile.yaml" ]; then
        while IFS= read -r line; do
            local trimmed
            trimmed=$(echo "$line" | sed 's/^[[:space:]]*-[[:space:]]*//' | xargs)
            [ -n "$trimmed" ] && FILES+=("$trimmed")
        done < <(sed -n '/^key_files:/,/^[a-z]/{
            /^[[:space:]]*-/p
        }' factory/profile.yaml 2>/dev/null)
    fi

    # Fallback: auto-discover common framework files
    if [ ${#FILES[@]} -eq 0 ]; then
        while IFS= read -r f; do
            FILES+=("$f")
        done < <(find . -maxdepth 4 -type f \( \
            -name "schema.rs" -o -name "mod.rs" -o -name "lib.rs" \
            -o -name "types.ts" -o -name "schema.ts" -o -name "schema.prisma" \
            -o -name "models.py" -o -name "schema.py" \
        \) -not -path '*/node_modules/*' -not -path '*/target/*' 2>/dev/null | head -20)
    fi

    for FILE in "${FILES[@]}"; do
        if [ -f "${FILE}" ]; then
            local HASH
            HASH=$(md5 -q "${FILE}" 2>/dev/null || md5sum "${FILE}" | cut -d' ' -f1)
            echo "| ${FILE} | ${HASH} |" >> "${OUTPUT}"
        fi
    done
}

# Compare two fingerprint files and return a list of unchanged files.
# Usage: compare_fingerprints <current_fingerprints> <previous_fingerprints>
# Prints lines like: "schema.rs (hash: abc123)" for files with matching hashes
compare_fingerprints() {
    local CURRENT="$1"
    local PREVIOUS="$2"

    if [ ! -f "${CURRENT}" ] || [ ! -f "${PREVIOUS}" ]; then
        return
    fi

    while IFS='|' read -r _ FILE HASH _; do
        FILE=$(echo "${FILE}" | xargs)
        HASH=$(echo "${HASH}" | xargs)
        [ -z "${FILE}" ] || [ "${FILE}" = "File" ] || [ "${FILE}" = "------" ] && continue

        if grep -q "| ${FILE} | ${HASH} |" "${PREVIOUS}" 2>/dev/null; then
            local BASENAME
            BASENAME=$(basename "${FILE}")
            echo "${BASENAME} (${FILE}, hash: ${HASH})"
        fi
    done < "${CURRENT}"
}

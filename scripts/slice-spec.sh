#!/bin/bash
# core/scripts/slice-spec.sh — Extract focused phase specs from a founding/master document
# Usage: ./core/scripts/slice-spec.sh <phase-number>
# Example: ./core/scripts/slice-spec.sh 2
#
# This uses Claude to read the project's founding document and extract ONLY the
# sections needed for a specific phase into a self-contained spec file.
# The Builder Agent reads the OUTPUT, never the full founding document.
#
# Requires:
#   - specs/founding-document.md (or master spec file)
#   - factory/profile.yaml with optional phase_map config

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# FACTORY_DIR is only set when called from new-project.sh; fall back to empty
# so the `${FACTORY_DIR}/themes` candidate is just a missing path (handled).
FACTORY_DIR="${FACTORY_DIR:-}"

PHASE="${1:?Usage: ./core/scripts/slice-spec.sh <phase-number>}"
# Use zero-padded dir (e.g. specs/phase-01) to match phase.sh / lib.sh convention
OUTPUT_DIR="$(printf 'specs/phase-%02d' "${PHASE}")"
mkdir -p "${OUTPUT_DIR}"
OUTPUT="${OUTPUT_DIR}/README.md"

# ── Load phase mapping from profile.yaml if available ──
SECTIONS=""
PHASE_NAME=""
CODENAME_THEME=""

if [ -f "factory/profile.yaml" ]; then
    # Try to extract phase info from profile. The sed uses GNU-only multi-cmd
    # block syntax that BSD/macOS sed rejects; `|| true` keeps the script
    # alive under `set -e -o pipefail` when sed errors out.
    PHASE_NAME=$( { sed -n "/^phases:/,/^[a-z]/{/^[[:space:]]*${PHASE}:/,/^[[:space:]]*[0-9]*:/{/name:/s/.*name:[[:space:]]*//p}}" factory/profile.yaml 2>/dev/null | head -1; } || true)
    SECTIONS=$( { sed -n "/^phases:/,/^[a-z]/{/^[[:space:]]*${PHASE}:/,/^[[:space:]]*[0-9]*:/{/sections:/s/.*sections:[[:space:]]*//p}}" factory/profile.yaml 2>/dev/null | head -1; } || true)
    CODENAME_THEME=$( { sed -n "/^phases:/,/^[a-z]/{/^[[:space:]]*${PHASE}:/,/^[[:space:]]*[0-9]*:/{/theme:/s/.*theme:[[:space:]]*//p}}" factory/profile.yaml 2>/dev/null | head -1; } || true)
fi

# Fallbacks
PHASE_NAME="${PHASE_NAME:-Phase ${PHASE}}"
CODENAME_THEME="${CODENAME_THEME:-Alphabetical}"

# ── Resolve theme file → pre-select codenames ──
CODENAME_LIST=""
THEME_FILE=""
THEME_LOWER=$(echo "${CODENAME_THEME}" | tr '[:upper:]' '[:lower:]')

# Check for theme file in themes/ directory
for candidate_dir in "themes" "${FACTORY_DIR}/themes"; do
    if [ -f "${candidate_dir}/${THEME_LOWER}.txt" ]; then
        THEME_FILE="${candidate_dir}/${THEME_LOWER}.txt"
        break
    fi
done

if [ -n "${THEME_FILE}" ]; then
    # Use pick-theme.sh to pre-select 15 names (enough for a typical phase + splits)
    PICK_SCRIPT="${SCRIPT_DIR}/pick-theme.sh"
    if [ -x "${PICK_SCRIPT}" ]; then
        CODENAME_LIST=$("${PICK_SCRIPT}" "${THEME_LOWER}" 15 --spaced 2>/dev/null || true)
        if [ -n "${CODENAME_LIST}" ]; then
            echo "  Theme file: ${THEME_FILE}"
            echo "  Pre-selected codenames: $(echo "${CODENAME_LIST}" | wc -l | tr -d ' ') names"
        fi
    fi
fi

# ── Find the founding document ──
FOUNDING_DOC=""
for candidate in "specs/founding-document.md" "specs/master-spec.md" "specs/spec.md" "SPEC.md"; do
    if [ -f "${candidate}" ]; then
        FOUNDING_DOC="${candidate}"
        break
    fi
done

if [ -z "${FOUNDING_DOC}" ]; then
    echo "  Error: No founding document found."
    echo "  Expected one of: specs/founding-document.md, specs/master-spec.md, specs/spec.md, SPEC.md"
    exit 1
fi

echo "==========================================="
echo "  SPEC SLICER — Phase ${PHASE}: ${PHASE_NAME}"
if [ -n "${SECTIONS}" ]; then
    echo "  Extracting: ${SECTIONS}"
fi
echo "  Source: ${FOUNDING_DOC}"
echo "  Output: ${OUTPUT}"
echo "==========================================="

SECTION_INSTRUCTION=""
if [ -n "${SECTIONS}" ]; then
    SECTION_INSTRUCTION="Include ONLY these sections from the founding document: ${SECTIONS}
Also include the Phase ${PHASE} task list and passing conditions if they exist."
else
    SECTION_INSTRUCTION="Extract all content relevant to Phase ${PHASE} (${PHASE_NAME}) from the founding document.
Include architecture context, technical details, and the Phase ${PHASE} task list and passing conditions."
fi

SLICE_PROMPT="Read ${FOUNDING_DOC}. Extract a SELF-CONTAINED spec file for Phase ${PHASE}: ${PHASE_NAME}.

${SECTION_INSTRUCTION}

The output spec must be SELF-CONTAINED — a Builder Agent should be able to read ONLY this file (plus CLAUDE.md and .claude/rules/) and implement the phase. Include enough architecture context that the Builder understands how this phase fits, but do NOT include the full founding document.

Target size: 6-10K tokens (roughly 300-500 lines of markdown).

IMPORTANT: Each task section must be self-contained. When a task depends on prior tasks, reference the specific file paths, schemas, and interfaces created — don't assume the reader has seen earlier tasks.

CRITICAL: The LAST task of every phase MUST be a capstone task that integrates all new features into the user-visible app UI. After the capstone, a human must be able to launch the app and interact with everything built in this phase.

TASK ID FORMAT — CODENAMES:
- Each task gets a unique codename, NOT a numeric ID
- Theme for phase ${PHASE}: ${CODENAME_THEME}
- Codenames should be alphabetical within the phase
- Example: ### TASK alpaca: Setup and Configuration (not ### TASK 1.00001)
- Branch naming: feature/<codename> (e.g., feature/alpaca)
$(if [ -n "${CODENAME_LIST}" ]; then
echo "- USE THESE CODENAMES (pick from this list in order, skip any that don't fit):"
echo "${CODENAME_LIST}" | sed 's/^/  /'
echo "- If you need more names than listed, continue alphabetically within the theme: ${CODENAME_THEME}"
fi)

Format the output as a markdown file with:
1. Phase name, priority, status
2. Goal (1-2 sentences)
3. Architecture context (only what's relevant to this phase)
4. Technical details extracted from the relevant sections
5. Tasks with codename headings: ### TASK <codename>: <description>
6. LAST TASK: capstone — UI integration
7. Passing conditions (checkboxes)

ALSO generate a sequence.md file at ${OUTPUT_DIR}/sequence.md with format:
\`\`\`
# Phase ${PHASE}: ${PHASE_NAME}
# Theme: ${CODENAME_THEME}
#
# codename      spec-file                    depends        touches
codename1       task-codename1-desc.md       -              backend
codename2       task-codename2-desc.md       codename1      frontend
\`\`\`

Write the README to: ${OUTPUT}
Write the sequence file to: ${OUTPUT_DIR}/sequence.md"

claude "${SLICE_PROMPT}"

# ── Validate: reject numeric task IDs (should be codenames now) ──
if grep -qE "TASK ${PHASE}\.[0-9]+" "${OUTPUT}" 2>/dev/null; then
    echo ""
    echo "  WARNING: Generated spec contains numeric task IDs instead of codenames."
    echo "  Offending lines:"
    grep -nE "TASK ${PHASE}\.[0-9]+" "${OUTPUT}"
    echo ""
    echo "  Edit ${OUTPUT} to use codenames, or re-run the slicer."
fi

# ── Validate: check sequence.md was generated ──
if [ -f "${OUTPUT_DIR}/sequence.md" ]; then
    TASK_COUNT=$(grep -v '^#' "${OUTPUT_DIR}/sequence.md" | grep -v '^[[:space:]]*$' | wc -l | tr -d ' ')
    echo "  Sequence file: ${OUTPUT_DIR}/sequence.md (${TASK_COUNT} tasks)"
else
    echo ""
    echo "  WARNING: No sequence.md generated. Create it manually."
fi

echo ""
echo "================================================"
echo "  Spec created: ${OUTPUT}"
if [ -f "${OUTPUT_DIR}/sequence.md" ]; then
    FIRST_TASK=$(grep -v '^#' "${OUTPUT_DIR}/sequence.md" | grep -v '^[[:space:]]*$' | head -1 | awk '{print $1}')
    echo "  Review it, then run: ./core/scripts/ralph.sh ${FIRST_TASK}"
fi
echo "================================================"

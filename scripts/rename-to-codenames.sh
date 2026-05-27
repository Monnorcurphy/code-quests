#!/usr/bin/env bash
# core/scripts/rename-to-codenames.sh — Rename task spec files from numeric IDs to codenames.
#
# Reads each specs/phase-N/sequence.md to get the codename-to-suffix mapping,
# finds the existing file that matches the suffix, and renames it.
#
# Usage:
#   ./core/scripts/rename-to-codenames.sh          # dry-run (prints what would happen)
#   ./core/scripts/rename-to-codenames.sh --apply   # actually rename files
#
# The script also updates internal TASK references within spec files:
#   "TASK 1.00001" -> "TASK alpaca"
#   "Task 4.1"     -> "Task ark"

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Source shared helpers for sed_escape_pattern / sed_escape_replacement
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/lib.sh" 2>/dev/null || true
APPLY=false
ERRORS=0
RENAMES=0
SKIPPED=0

if [[ "${1:-}" == "--apply" ]]; then
  APPLY=true
fi

# Temp file to accumulate old-ID -> codename mappings for reference updates.
# Format: old_id<TAB>codename (one per line)
MAPFILE=$(mktemp)
trap 'rm -f "$MAPFILE"' EXIT

# ---------------------------------------------------------------------------
# Pass 1: Rename files
# ---------------------------------------------------------------------------

# Discover all phase directories dynamically
for phase_dir in "${REPO_ROOT}"/specs/phase-*/; do
  [[ -d "$phase_dir" ]] || continue
  phase_num=$(basename "$phase_dir" | sed 's/phase-//')
  seq_file="${phase_dir}/sequence.md"

  if [[ ! -f "$seq_file" ]]; then
    echo "SKIP: No sequence.md in phase-${phase_num}"
    continue
  fi

  echo ""
  echo "Phase ${phase_num}:"

  # Extract old-ID -> codename mapping from comment lines.
  # Lines look like: #   1.00001 -> alpaca     (monorepo)
  #              or: #   4.1  -> ark          (job-postings-table)
  grep -E '^#[[:space:]]+[0-9]+\.[0-9]+' "$seq_file" | while IFS= read -r line; do
    # Extract the numeric ID and codename
    old_id=$(echo "$line" | awk -F'→' '{print $1}' | sed 's/^#//' | tr -d ' ')
    codename=$(echo "$line" | awk -F'→' '{print $2}' | awk '{print $1}')
    if [[ -n "$old_id" && -n "$codename" ]]; then
      printf '%s\t%s\n' "$old_id" "$codename" >> "$MAPFILE"
    fi
  done

  # Read data lines to get codename -> new filename -> suffix.
  # Then find the existing file that matches the suffix.
  while IFS= read -r line; do
    # Skip comments and blank lines
    case "$line" in
      '#'*|'') continue ;;
    esac

    # Parse: codename  spec-file  depends  touches
    codename=$(echo "$line" | awk '{print $1}')
    new_filename=$(echo "$line" | awk '{print $2}')

    # Extract the suffix: task-codename-SUFFIX.md -> SUFFIX
    # new_filename looks like: task-alpaca-monorepo.md
    escaped_codename=$(sed_escape_pattern "${codename}")
    suffix=$(echo "$new_filename" | sed "s/^task-${escaped_codename}-//" | sed 's/\.md$//')

    if [[ -z "$suffix" ]]; then
      echo "  ERROR: Could not extract suffix from ${new_filename}"
      ERRORS=$((ERRORS + 1))
      continue
    fi

    # Find the existing file that ends with -${suffix}.md in the phase directory.
    old_file=""
    for candidate in "${phase_dir}"/task-*-"${suffix}.md"; do
      if [[ -f "$candidate" ]]; then
        old_file="$candidate"
        break
      fi
    done

    if [[ -z "$old_file" || ! -f "$old_file" ]]; then
      # Try exact match on the new filename (already renamed?)
      if [[ -f "${phase_dir}/${new_filename}" ]]; then
        echo "  SKIP: ${new_filename} already exists (already renamed?)"
        SKIPPED=$((SKIPPED + 1))
        continue
      fi
      echo "  ERROR: No existing file found matching suffix '${suffix}' in phase-${phase_num}/"
      ERRORS=$((ERRORS + 1))
      continue
    fi

    old_basename=$(basename "$old_file")

    if [[ "$old_basename" == "$new_filename" ]]; then
      echo "  SKIP: ${old_basename} (no change needed)"
      SKIPPED=$((SKIPPED + 1))
      continue
    fi

    if $APPLY; then
      mv "${old_file}" "${phase_dir}/${new_filename}"
      echo "  RENAMED: ${old_basename} -> ${new_filename}"
    else
      echo "  ${old_basename} -> ${new_filename}"
    fi
    RENAMES=$((RENAMES + 1))

  done < "$seq_file"
done

# ---------------------------------------------------------------------------
# Pass 2: Update internal TASK references within spec files
# ---------------------------------------------------------------------------

echo ""
echo "--- Internal reference updates ---"

if [[ ! -s "$MAPFILE" ]]; then
  echo "  No ID -> codename mappings found; skipping reference updates."
else
  # Build a sed script file. Sort by longest ID first to avoid partial
  # replacements (e.g., "4.10" must be replaced before "4.1").
  SED_SCRIPT=$(mktemp)
  trap 'rm -f "$MAPFILE" "$SED_SCRIPT"' EXIT

  sort -t'	' -k1,1 -rn "$MAPFILE" | while IFS='	' read -r old_id codename; do
    [[ -z "$old_id" || -z "$codename" ]] && continue
    # Escape dots in old_id for sed regex
    escaped_id=$(echo "$old_id" | sed 's/\./\\./g')
    # Escape codename for safe use in sed replacement
    escaped_codename=$(sed_escape_replacement "${codename}")
    # "TASK X.Y" or "Task X.Y" or "task X.Y"
    echo "s/TASK ${escaped_id}/TASK ${escaped_codename}/g"
    echo "s/Task ${escaped_id}/Task ${escaped_codename}/g"
    echo "s/task ${escaped_id}/task ${escaped_codename}/g"
    # "task-X.Y-" prefix in cross-references
    echo "s/task-${escaped_id}-/task-${escaped_codename}-/g"
  done > "$SED_SCRIPT"

  if [[ ! -s "$SED_SCRIPT" ]]; then
    echo "  No sed rules generated; skipping."
  else
    REF_COUNT=0
    for phase_dir in "${REPO_ROOT}"/specs/phase-*/; do
      [[ -d "$phase_dir" ]] || continue
      for spec_file in "${phase_dir}"/task-*.md; do
        [[ -f "$spec_file" ]] || continue

        if $APPLY; then
          # Check if any substitutions would be made
          if sed -f "$SED_SCRIPT" "$spec_file" | diff -q - "$spec_file" > /dev/null 2>&1; then
            continue
          fi
          sed -i '' -f "$SED_SCRIPT" "$spec_file"
          echo "  UPDATED refs in: $(basename "$spec_file")"
          REF_COUNT=$((REF_COUNT + 1))
        else
          # Dry-run: show files that would be changed
          if ! sed -f "$SED_SCRIPT" "$spec_file" | diff -q - "$spec_file" > /dev/null 2>&1; then
            echo "  Would update refs in: $(basename "$spec_file")"
            REF_COUNT=$((REF_COUNT + 1))
          fi
        fi
      done
    done
    echo "  ${REF_COUNT} files with reference updates"
  fi
fi

echo ""
echo "--- Summary ---"
echo "Renames: ${RENAMES}"
echo "Skipped: ${SKIPPED}"
echo "Errors:  ${ERRORS}"
if ! $APPLY; then
  echo ""
  echo "This was a DRY RUN. Pass --apply to execute the renames."
fi

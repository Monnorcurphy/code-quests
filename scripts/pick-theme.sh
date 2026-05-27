#!/usr/bin/env bash
# core/scripts/pick-theme.sh — Select codenames from a theme file
#
# Usage:
#   pick-theme.sh --list                              # List all themes with counts
#   pick-theme.sh <theme> <N>                         # Pick N names, spread across alphabet
#   pick-theme.sh <theme> <N> --spaced                # Pick with letter gaps for splits
#   pick-theme.sh <theme> <N> --random                # Pick N random names
#   pick-theme.sh <theme> --all                       # Show all names in a theme
#   pick-theme.sh --validate <sequence.md> <theme>    # Validate codenames against theme

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Resolve themes dir: check project-local first, then factory source
if [ -d "themes" ]; then
    THEMES_DIR="themes"
elif [ -d "${SCRIPT_DIR}/../../themes" ]; then
    THEMES_DIR="${SCRIPT_DIR}/../../themes"
else
    echo "Error: No themes/ directory found." >&2
    exit 1
fi

# ── Helpers ──

to_lower() {
    echo "$1" | tr '[:upper:]' '[:lower:]'
}

get_names() {
    grep -v '^#' "$1" | grep -v '^[[:space:]]*$' | sort
}

count_names() {
    get_names "$1" | wc -l | tr -d ' '
}

theme_file() {
    local theme
    theme=$(to_lower "$1")
    local file="${THEMES_DIR}/${theme}.txt"
    if [ ! -f "$file" ]; then
        echo "Error: Theme '${theme}' not found. Run --list to see available themes." >&2
        exit 1
    fi
    echo "$file"
}

# ── Commands ──

cmd_list() {
    echo "Available themes:"
    echo ""
    printf "  %-20s %6s  %s\n" "THEME" "COUNT" "CATEGORY"
    printf "  %-20s %6s  %s\n" "-----" "-----" "--------"
    for file in "${THEMES_DIR}"/*.txt; do
        [ -f "$file" ] || continue
        local name count category
        name=$(basename "$file" .txt)
        count=$(count_names "$file")
        category=$(grep '^# Category:' "$file" 2>/dev/null | sed 's/^# Category:[[:space:]]*//' | head -1)
        category="${category:-—}"
        printf "  %-20s %6s  %s\n" "$name" "$count" "$category"
    done
    echo ""
    local total
    total=$(find "${THEMES_DIR}" -maxdepth 1 -name '*.txt' | wc -l | tr -d ' ')
    echo "  ${total} themes total"
}

cmd_all() {
    local file
    file=$(theme_file "$1")
    get_names "$file"
}

cmd_pick_spread() {
    local file="$1" n="$2"

    local names_tmp
    names_tmp=$(mktemp)
    get_names "$file" > "$names_tmp"
    local total
    total=$(wc -l < "$names_tmp" | tr -d ' ')

    if [ "$n" -ge "$total" ]; then
        cat "$names_tmp"
        rm -f "$names_tmp"
        return
    fi

    # Get sorted unique starting letters
    local letters
    letters=$(cut -c1 "$names_tmp" | sort -u | tr -d '\n')

    local selected_tmp
    selected_tmp=$(mktemp)
    local picked=0
    local round=0

    while [ "$picked" -lt "$n" ]; do
        local found_any=0
        local i=0
        while [ "$i" -lt "${#letters}" ]; do
            [ "$picked" -ge "$n" ] && break
            local letter="${letters:$i:1}"
            # Get the (round+1)-th name starting with this letter
            local pick
            pick=$(grep "^${letter}" "$names_tmp" | sed -n "$((round + 1))p")
            if [ -n "$pick" ]; then
                echo "$pick" >> "$selected_tmp"
                picked=$((picked + 1))
                found_any=1
            fi
            i=$((i + 1))
        done
        if [ "$found_any" -eq 0 ]; then
            break
        fi
        round=$((round + 1))
    done

    sort "$selected_tmp"
    rm -f "$names_tmp" "$selected_tmp"
}

cmd_pick_spaced() {
    local file="$1" n="$2"

    local names_tmp
    names_tmp=$(mktemp)
    get_names "$file" > "$names_tmp"
    local total
    total=$(wc -l < "$names_tmp" | tr -d ' ')

    if [ "$n" -ge "$total" ]; then
        cat "$names_tmp"
        rm -f "$names_tmp"
        return
    fi

    # Get sorted unique starting letters
    local all_letters
    all_letters=$(cut -c1 "$names_tmp" | sort -u | tr -d '\n')

    # Skip every other letter
    local spaced_letters=""
    local skip=0
    local i=0
    while [ "$i" -lt "${#all_letters}" ]; do
        if [ "$skip" -eq 0 ]; then
            spaced_letters="${spaced_letters}${all_letters:$i:1}"
            skip=1
        else
            skip=0
        fi
        i=$((i + 1))
    done

    local selected_tmp
    selected_tmp=$(mktemp)
    local picked=0
    local round=0

    while [ "$picked" -lt "$n" ]; do
        local found_any=0
        i=0
        while [ "$i" -lt "${#spaced_letters}" ]; do
            [ "$picked" -ge "$n" ] && break
            local letter="${spaced_letters:$i:1}"
            local pick
            pick=$(grep "^${letter}" "$names_tmp" | sed -n "$((round + 1))p")
            if [ -n "$pick" ]; then
                echo "$pick" >> "$selected_tmp"
                picked=$((picked + 1))
                found_any=1
            fi
            i=$((i + 1))
        done
        if [ "$found_any" -eq 0 ]; then
            # Fall back to all letters for remaining picks
            i=0
            while [ "$i" -lt "${#all_letters}" ]; do
                [ "$picked" -ge "$n" ] && break
                local letter="${all_letters:$i:1}"
                local pick
                pick=$(grep "^${letter}" "$names_tmp" | sed -n "$((round + 1))p")
                if [ -n "$pick" ] && ! grep -qx "$pick" "$selected_tmp" 2>/dev/null; then
                    echo "$pick" >> "$selected_tmp"
                    picked=$((picked + 1))
                fi
                i=$((i + 1))
            done
            break
        fi
        round=$((round + 1))
    done

    sort "$selected_tmp"
    rm -f "$names_tmp" "$selected_tmp"
}

cmd_pick_random() {
    local file="$1" n="$2"
    if command -v shuf >/dev/null 2>&1; then
        get_names "$file" | shuf | head -n "$n" | sort
    elif command -v gshuf >/dev/null 2>&1; then
        get_names "$file" | gshuf | head -n "$n" | sort
    else
        # Fallback: use awk for pseudo-random
        get_names "$file" | awk 'BEGIN{srand()}{print rand()"\t"$0}' | sort -n | head -n "$n" | cut -f2- | sort
    fi
}

cmd_validate() {
    local sequence_file="$1"
    local file
    file=$(theme_file "$2")

    if [ ! -f "$sequence_file" ]; then
        echo "Error: Sequence file not found: ${sequence_file}" >&2
        exit 1
    fi

    local valid_tmp
    valid_tmp=$(mktemp)
    get_names "$file" > "$valid_tmp"

    local codenames_tmp
    codenames_tmp=$(mktemp)
    grep -v '^#' "$sequence_file" | grep -v '^[[:space:]]*$' | awk '{print $1}' > "$codenames_tmp"

    local errors=0
    local total=0
    while IFS= read -r codename; do
        total=$((total + 1))
        if ! grep -qx "$codename" "$valid_tmp"; then
            echo "  INVALID: '${codename}' is not in theme '$(basename "$file" .txt)'"
            errors=$((errors + 1))
        fi
    done < "$codenames_tmp"

    if [ "$errors" -eq 0 ]; then
        echo "  All ${total} codenames are valid in theme '$(basename "$file" .txt)'"
    else
        echo ""
        echo "  ${errors} invalid codename(s) found"
        rm -f "$valid_tmp" "$codenames_tmp"
        exit 1
    fi

    rm -f "$valid_tmp" "$codenames_tmp"
}

# ── Main ──

if [ $# -eq 0 ]; then
    echo "Usage: pick-theme.sh --list | <theme> <N> [--spaced|--random] | <theme> --all | --validate <file> <theme>"
    exit 1
fi

case "$1" in
    --list)
        cmd_list
        ;;
    --validate)
        [ $# -lt 3 ] && { echo "Usage: pick-theme.sh --validate <sequence.md> <theme>" >&2; exit 1; }
        cmd_validate "$2" "$3"
        ;;
    *)
        THEME="$1"
        shift
        [ $# -eq 0 ] && { echo "Usage: pick-theme.sh <theme> <N> [--spaced|--random] | <theme> --all" >&2; exit 1; }

        THEME_FILE=$(theme_file "$THEME")

        if [ "$1" = "--all" ]; then
            get_names "$THEME_FILE"
        else
            N="$1"
            shift
            MODE="spread"
            if [ $# -gt 0 ]; then
                case "$1" in
                    --spaced) MODE="spaced" ;;
                    --random) MODE="random" ;;
                    *) echo "Unknown option: $1" >&2; exit 1 ;;
                esac
            fi

            case "$MODE" in
                spread) cmd_pick_spread "$THEME_FILE" "$N" ;;
                spaced) cmd_pick_spaced "$THEME_FILE" "$N" ;;
                random) cmd_pick_random "$THEME_FILE" "$N" ;;
            esac
        fi
        ;;
esac

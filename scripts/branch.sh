#!/bin/bash
# core/scripts/branch.sh — Deterministic branch management
# Usage: source core/scripts/branch.sh
#        branch_resolve <branch-name> <mode>
#
# Modes:
#   overwrite  — delete existing branch, create fresh
#   resume     — checkout existing branch
#   new        — create -v2, -v3, etc.
#   prompt     — interactive choice (TTY only)
#
# Returns: sets BRANCH to the resolved branch name

branch_resolve() {
    local BRANCH="$1"
    local MODE="${2:-prompt}"

    local LOCAL_EXISTS=$(git rev-parse --verify "${BRANCH}" >/dev/null 2>&1 && echo "yes" || echo "no")
    local REMOTE_EXISTS=$(git ls-remote --exit-code --heads origin "${BRANCH}" >/dev/null 2>&1 && echo "yes" || echo "no")

    # Branch doesn't exist — just create it
    if [ "${LOCAL_EXISTS}" = "no" ] && [ "${REMOTE_EXISTS}" = "no" ]; then
        echo "→ Creating branch ${BRANCH}..."
        git checkout -b "${BRANCH}"
        return 0
    fi

    echo "  ⚠️  Branch ${BRANCH} already exists."

    # Determine action
    local CHOICE=""
    case "${MODE}" in
        overwrite) CHOICE="2"; echo "  (--overwrite — deleting and restarting)" ;;
        resume)    CHOICE="1"; echo "  (--resume — continuing existing branch)" ;;
        new)       CHOICE="3"; echo "  (--new-branch — creating versioned branch)" ;;
        prompt)
            if [ -t 0 ]; then
                echo ""
                echo "  [1] Resume    — continue from where it left off  (default)"
                echo "  [2] Overwrite — delete and start fresh"
                echo "  [3] New branch — create ${BRANCH}-v2 instead"
                echo ""
                printf "  Choose [1/2/3]: "
                read -r CHOICE </dev/tty
            else
                CHOICE="1"
                echo "  (non-interactive — defaulting to Resume)"
            fi
            ;;
    esac

    case "${CHOICE}" in
        2)
            echo ""
            echo "→ Overwriting — deleting ${BRANCH}..."
            rm -f specs/bugs/review-*.md
            rm -f specs/done/review-pass-*.md
            [ "${LOCAL_EXISTS}" = "yes" ] && git branch -D "${BRANCH}"
            [ "${REMOTE_EXISTS}" = "yes" ] && git push origin --delete "${BRANCH}" 2>/dev/null || true
            git checkout -b "${BRANCH}"
            ;;
        3)
            local SUFFIX=2
            while git rev-parse --verify "${BRANCH}-v${SUFFIX}" >/dev/null 2>&1 || \
                  git ls-remote --exit-code --heads origin "${BRANCH}-v${SUFFIX}" >/dev/null 2>&1; do
                SUFFIX=$((SUFFIX + 1))
            done
            BRANCH="${BRANCH}-v${SUFFIX}"
            echo ""
            echo "→ Creating new branch ${BRANCH}..."
            git checkout -b "${BRANCH}"
            ;;
        *)
            echo ""
            echo "→ Resuming ${BRANCH}..."
            if [ "${LOCAL_EXISTS}" = "yes" ]; then
                git checkout "${BRANCH}"
            else
                git fetch origin "${BRANCH}"
                git checkout -b "${BRANCH}" "origin/${BRANCH}"
            fi
            ;;
    esac
}

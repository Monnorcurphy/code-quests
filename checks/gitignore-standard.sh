#!/bin/bash
# checks/gitignore-standard.sh — Verify .gitignore has standard entries
# Usage: ./checks/gitignore-standard.sh [search-path]
#
# Checks that .gitignore exists and includes standard entries based on
# what the project actually uses (package.json -> node_modules, etc.).
#
# Exit 0 if clean, 1 if missing entries found

SEARCH_PATH="${1:-.}"
FOUND=0
MISSING=""

GITIGNORE="${SEARCH_PATH}/.gitignore"

# ── Check .gitignore exists ──
if [ ! -f "$GITIGNORE" ]; then
    echo "❌ No .gitignore found at ${GITIGNORE}"
    echo "Fix: create a .gitignore with standard entries for your project type"
    exit 1
fi

# ── Universal entries every project should have ──
UNIVERSAL=".DS_Store .env .env.local *.log"

for entry in $UNIVERSAL; do
    if ! grep -qF "${entry}" "$GITIGNORE" 2>/dev/null; then
        # Also check for wildcard patterns that might cover it
        # e.g., .env* covers .env.local
        case "$entry" in
            ".env.local")
                grep -qF '.env' "$GITIGNORE" 2>/dev/null && continue
                ;;
        esac
        MISSING="${MISSING}  - ${entry}\n"
        FOUND=1
    fi
done

# ── Node.js project (package.json exists) ──
if [ -f "${SEARCH_PATH}/package.json" ]; then
    NODE_ENTRIES="node_modules dist"
    for entry in $NODE_ENTRIES; do
        if ! grep -q "^${entry}\|^/${entry}" "$GITIGNORE" 2>/dev/null; then
            MISSING="${MISSING}  - ${entry} (Node.js project)\n"
            FOUND=1
        fi
    done
fi

# ── Rust project (Cargo.toml exists) ──
if [ -f "${SEARCH_PATH}/Cargo.toml" ]; then
    if ! grep -q '^target\|^/target' "$GITIGNORE" 2>/dev/null; then
        MISSING="${MISSING}  - target/ (Rust project)\n"
        FOUND=1
    fi
fi

# ── Python project (requirements.txt or pyproject.toml exists) ──
if [ -f "${SEARCH_PATH}/requirements.txt" ] || [ -f "${SEARCH_PATH}/pyproject.toml" ]; then
    PYTHON_ENTRIES="__pycache__ *.pyc .venv venv"
    for entry in $PYTHON_ENTRIES; do
        if ! grep -q "^${entry}\|^/${entry}" "$GITIGNORE" 2>/dev/null; then
            MISSING="${MISSING}  - ${entry} (Python project)\n"
            FOUND=1
        fi
    done
fi

# ── Report results ──
if [ "$FOUND" -eq 1 ]; then
    echo "❌ .gitignore is missing standard entries:"
    printf "$MISSING"
    echo ""
    echo "Fix: add the missing entries to .gitignore"
else
    echo "✅ .gitignore has all standard entries"
fi

exit ${FOUND}

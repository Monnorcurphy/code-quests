#!/bin/bash
# checks/dead-endpoint.sh — Detect frontend fetch calls to non-existent backend routes
# Usage: ./checks/dead-endpoint.sh [search-path]
#
# Best-effort cross-reference:
# 1. Find all fetch('/api/...') and axios calls in frontend code
# 2. Find all route definitions (app.get, router.post, etc.) in server code
# 3. Flag frontend calls that don't match any server route
#
# This is BEST EFFORT — if we can't determine routes, exit 0 (skip).
#
# Exit 0 if clean or can't determine, 1 if mismatches found

SEARCH_PATH="${1:-.}"

EXCLUDES="--exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build --exclude-dir=target --exclude-dir=venv --exclude-dir=__pycache__"

# ── Find server route definitions ──
# Look for Express-style: app.get('/api/...'), router.post('/api/...'), etc.
SERVER_ROUTES=$(grep -roh ${EXCLUDES} -E "(app|router)\.(get|post|put|patch|delete)\(\s*['\"]\/api\/[^'\"]*['\"]" "${SEARCH_PATH}" \
    --include="*.ts" --include="*.js" --include="*.mjs" \
    2>/dev/null | grep -oE '/api/[^'"'"'"]+' | sort -u)

# If no server routes found, this project may not use Express — skip gracefully
if [ -z "$SERVER_ROUTES" ]; then
    echo "✅ No Express-style API routes detected — skipping dead endpoint check"
    exit 0
fi

# ── Find frontend API calls ──
# fetch('/api/...'), axios.get('/api/...'), axios.post('/api/...'), etc.
FRONTEND_CALLS=$(grep -rn ${EXCLUDES} -E "(fetch|axios\.\w+)\(\s*['\"\`]\/api\/[^'\"\`]*" "${SEARCH_PATH}" \
    --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
    2>/dev/null | grep -v '\.test\.' | grep -v '\.spec\.')

if [ -z "$FRONTEND_CALLS" ]; then
    echo "✅ No frontend API calls detected"
    exit 0
fi

# Extract just the API paths from frontend calls
FRONTEND_PATHS=$(echo "$FRONTEND_CALLS" | grep -oE '/api/[^'"'"'"`\s\)]+' | sort -u)

# ── Cross-reference ──
FOUND=0
DEAD=""

while IFS= read -r path; do
    [ -z "$path" ] && continue
    # Strip dynamic segments for matching: /api/users/:id -> /api/users
    NORMALIZED=$(echo "$path" | sed 's/\/:[^/]*//g' | sed 's/\/${[^}]*}//g')

    # Check if any server route matches (exact or prefix)
    MATCHED=0
    while IFS= read -r route; do
        [ -z "$route" ] && continue
        ROUTE_NORM=$(echo "$route" | sed 's/\/:[^/]*//g')
        if [ "$NORMALIZED" = "$ROUTE_NORM" ] || echo "$ROUTE_NORM" | grep -q "^${NORMALIZED}"; then
            MATCHED=1
            break
        fi
    done <<< "$SERVER_ROUTES"

    if [ "$MATCHED" -eq 0 ]; then
        DEAD="${DEAD}  ${path}\n"
        FOUND=1
    fi
done <<< "$FRONTEND_PATHS"

if [ "$FOUND" -eq 1 ]; then
    echo "❌ Frontend calls to API endpoints with no matching server route:"
    printf "$DEAD"
    echo ""
    echo "Server routes found:"
    echo "$SERVER_ROUTES" | head -20
    echo ""
    echo "Fix: add the missing route handler, or update the frontend to use the correct endpoint"
    exit 1
fi

echo "✅ All frontend API calls match server routes"
exit 0

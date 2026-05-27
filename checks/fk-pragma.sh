#!/bin/bash
# checks/fk-pragma.sh — Verify SQLite foreign key pragma is enabled
# Usage: ./checks/fk-pragma.sh [search-path]
#
# SQLite disables foreign key enforcement by default. Without
# `PRAGMA foreign_keys = ON`, all FK constraints are silently ignored —
# orphaned rows, broken relationships, and data corruption go undetected.
#
# This must be set in BOTH production database init AND test database init
# (in-memory databases also default to FK off).
#
# Exit 0 if clean (or no SQLite usage), 1 if FK pragma missing

SEARCH_PATH="${1:-.}"
FAIL=0

# Find files that open SQLite connections
DB_FILES=$(grep -rEl 'open_in_memory|Connection::open|sqlite3\.connect|new Database|rusqlite|better-sqlite3|sqlite3' \
    "${SEARCH_PATH}" \
    --include="*.rs" --include="*.py" --include="*.ts" --include="*.js" \
    --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=target \
    --exclude-dir=projects --exclude-dir=ui --exclude-dir=adversarial-tests \
    2>/dev/null | grep -v test | grep -v '.test.')

if [ -z "${DB_FILES}" ]; then
    exit 0
fi

for FILE in ${DB_FILES}; do
    if ! grep -qE 'foreign_keys\s*=\s*ON|foreign_keys=ON|PRAGMA foreign_keys' "${FILE}" 2>/dev/null; then
        echo "❌ Missing FK pragma in: ${FILE}"
        echo "   SQLite ignores all foreign key constraints without PRAGMA foreign_keys = ON"
        FAIL=1
    fi
done

# Also check test helpers — FK must be on in tests too
TEST_DB_FILES=$(grep -rEl 'open_in_memory|Connection::open|sqlite3\.connect|new Database' \
    "${SEARCH_PATH}" \
    --include="*.rs" --include="*.py" --include="*.ts" --include="*.js" \
    --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=target \
    --exclude-dir=projects --exclude-dir=ui --exclude-dir=adversarial-tests \
    2>/dev/null | grep -E 'test|spec')

for FILE in ${TEST_DB_FILES}; do
    if ! grep -qE 'foreign_keys\s*=\s*ON|foreign_keys=ON|PRAGMA foreign_keys' "${FILE}" 2>/dev/null; then
        echo "⚠️  Missing FK pragma in test file: ${FILE}"
        echo "   Tests with FK off will pass even when constraints are violated"
        FAIL=1
    fi
done

if [ "${FAIL}" -eq 0 ]; then
    echo "✅ FK pragma found in all SQLite connection files"
fi

exit ${FAIL}

#!/bin/bash
# checks/binary-assets.sh — Validate binary assets aren't corrupt placeholders
# Usage: ./checks/binary-assets.sh [search-path]
#
# Binary assets referenced in config must be valid, not just present.
# Corrupt placeholders compile fine but crash at runtime — often behind
# native boundaries that swallow the real error message.
#
# Exit 0 if clean, 1 if suspect assets found

SEARCH_PATH="${1:-.}"
FAIL=0

# ── Icon files (any desktop/mobile app framework) ──
# .icns files under 1KB are almost certainly corrupt (valid icons are 10KB+)
for f in $(find "${SEARCH_PATH}" -name "*.icns" -not -path "*/node_modules/*" -not -path "*/target/*" 2>/dev/null | sort -u); do
    SIZE=$(wc -c < "$f" | tr -d ' ')
    if [ "${SIZE}" -lt 1000 ]; then
        echo "❌ Suspect icon: ${f} (${SIZE} bytes — likely corrupt, need 10KB+)"
        echo "   Fix: regenerate from a valid source image using your framework's icon tooling"
        FAIL=1
    fi
done

# .ico files under 200 bytes are suspect
for f in $(find "${SEARCH_PATH}" -name "*.ico" -not -path "*/node_modules/*" -not -path "*/target/*" 2>/dev/null | sort -u); do
    SIZE=$(wc -c < "$f" | tr -d ' ')
    if [ "${SIZE}" -lt 200 ]; then
        echo "❌ Suspect icon: ${f} (${SIZE} bytes — likely corrupt)"
        FAIL=1
    fi
done

# .png files under 100 bytes used as icons are suspect (valid PNGs are 500B+)
for f in $(find "${SEARCH_PATH}" -path "*/icons/*.png" -not -path "*/node_modules/*" -not -path "*/target/*" 2>/dev/null | sort -u); do
    SIZE=$(wc -c < "$f" | tr -d ' ')
    if [ "${SIZE}" -lt 100 ]; then
        echo "❌ Suspect icon: ${f} (${SIZE} bytes — likely placeholder)"
        FAIL=1
    fi
done

if [ "${FAIL}" -eq 0 ]; then
    # Only print success if we actually found files to check
    COUNT=$(find "${SEARCH_PATH}" \( -name "*.icns" -o -name "*.ico" -o -path "*/icons/*.png" \) -not -path "*/node_modules/*" -not -path "*/target/*" 2>/dev/null | wc -l | tr -d ' ')
    if [ "${COUNT}" -gt 0 ]; then
        echo "✅ ${COUNT} binary asset(s) validated"
    fi
fi

exit ${FAIL}

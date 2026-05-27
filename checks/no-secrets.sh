#!/bin/bash
# checks/no-secrets.sh — Grep for common secret patterns
# Usage: ./checks/no-secrets.sh [search-path]
# Exit 0 if clean, 1 if secrets found

SEARCH_PATH="${1:-.}"

# Common secret patterns
PATTERNS='\bsk-[a-zA-Z0-9]\{20,\}\|AKIA[A-Z0-9]\{16\}\|api_key\s*=\s*["\x27][^"\x27]\+["\x27]\|SECRET_KEY\s*=\s*["\x27][^"\x27]\+["\x27]\|PRIVATE_KEY\s*=\s*["\x27][^"\x27]\+["\x27]\|password\s*=\s*["\x27][^"\x27]\+["\x27]\|-----BEGIN.*PRIVATE KEY'

# Excluded dirs/files
EXCLUDES="--exclude-dir=.git --exclude-dir=node_modules --exclude-dir=target --exclude-dir=venv --exclude-dir=.venv --exclude-dir=__pycache__ --exclude-dir=metrics --exclude-dir=specs --exclude-dir=docs --exclude-dir=projects --exclude-dir=ui --exclude-dir=adversarial-tests --exclude=*.lock --exclude=*.sum --exclude=*.log"

MATCHES=$(grep -rn ${EXCLUDES} "${PATTERNS}" "${SEARCH_PATH}" 2>/dev/null | grep -v '\.test\.' | grep -v '\.spec\.' | grep -v 'no-secrets\.sh')

if [ -n "$MATCHES" ]; then
    echo "❌ Potential secrets found:"
    echo "$MATCHES" | head -20
    exit 1
fi

exit 0

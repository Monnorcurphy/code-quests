#!/usr/bin/env bash
# Validates assets/manifest.json against the files in assets/.
# Delegates to the Node.js implementation for JSON handling.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/check-asset-licenses.mjs"

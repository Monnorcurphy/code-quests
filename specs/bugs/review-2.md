# BUG: `existsSync` used before its declaration in check-asset-licenses.mjs

**Severity:** LOW
**File(s):** scripts/check-asset-licenses.mjs

## Problem

`scripts/check-asset-licenses.mjs` calls `existsSync(MANIFEST_PATH)` on line 19, but the `existsSync` function is not declared until line 24:

```js
// Line 19
if (!existsSync(MANIFEST_PATH)) {
  console.error(`ERROR: assets/manifest.json not found at ${MANIFEST_PATH}`);
  process.exit(1);
}

// Line 24
function existsSync(p) {
  try { statSync(p); return true; } catch { return false; }
}
```

This works at runtime only because JS function declarations are hoisted, but:

1. It is confusing to read — the call appears to reference an undefined identifier.
2. It shadows `fs.existsSync` without an obvious reason (the same name is what `fs` already provides). If a future edit imports `existsSync` from `fs`, the imported version and the local helper will conflict silently.
3. `no-use-before-define` would flag this in any standard ESLint config (the project doesn't lint `.mjs` files, so this slipped through).

## Expected

Either:
- Move the `function existsSync` declaration above its first call, OR
- Import `existsSync` from `fs` (it already exists there — `node:fs` exports it) and delete the local helper entirely.

## Fix

Replace the local helper with the built-in import:

```js
import { existsSync, readdirSync, statSync, readFileSync } from 'fs';
```

…and delete the local `function existsSync(p) { ... }` block on lines 24–26.

# BUG: Temp .mcp.json written with world-readable permissions can leak MCP server secrets

**Severity:** HIGH
**File(s):** packages/server/src/agents/cc-adapter.ts

## Problem

`writeTempMcpConfig()` writes the MCP config to `tmpdir()` via `writeFile(filePath, JSON.stringify(mcpConfig), 'utf8')` without specifying a `mode`. Node's default mode is `0o666` and (with a typical umask of `0o022`) the file lands at `0o644` — readable by any local user.

MCP server configs are commonly shaped like:

```json
{ "command": "node", "args": ["server.js"], "env": { "API_KEY": "sk-..." } }
```

so the on-disk JSON in `/tmp/cq-mcp-*.json` can contain secrets (API keys, tokens) that any other local account can read while the quest is running. This collides with `rules/core/security.md §1` (no secrets stored unsafely) and the project rule that secrets must not appear on disk in a way that other principals can access.

## Expected

Per the security rules, anything containing user-provided credentials must be unreadable by other local users. Temp files holding MCP config should be created with owner-only permissions (`0o600`) — and ideally in a per-user temp directory.

## Fix

In `packages/server/src/agents/cc-adapter.ts`, pass `{ mode: 0o600 }` when writing the temp file:

```ts
await writeFile(filePath, JSON.stringify(mcpConfig), { encoding: 'utf8', mode: 0o600 });
```

On systems where `writeFile` does not honor `mode` for an already-existing file, also `chmod` it afterwards (the random 8-byte name effectively prevents collisions, but a defensive `chmodSync(filePath, 0o600)` is cheap insurance).

Add a regression test that stats the produced file and asserts `(stat.mode & 0o777) === 0o600`.

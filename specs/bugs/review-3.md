# BUG: combat log accumulated but never persisted (dead code or unimplemented spec)

**Severity:** LOW
**File(s):** `packages/server/src/services/quest-runner.ts` (lines 8, 60, 64–67)

## Problem

The runner declares `const COMBAT_LOG_MAX_CHARS = 5000` and accumulates events into a local `combatLog` string:

```ts
let combatLog = '';
try {
  for await (const event of handle.events()) {
    publishEvent?.(quest.id, event);
    const entry = JSON.stringify(event) + '\n';
    if (combatLog.length + entry.length <= COMBAT_LOG_MAX_CHARS) {
      combatLog += entry;
    }
    ...
```

The variable is then never read, written to disk, or attached to any row. The spec asked for an in-memory cap of 5000 chars "for persistence on exit," but no persistence happens — and the `quests` table has no column for it (`monster_encounters.combat_log_json` is per-encounter, not per-quest).

This is dead code by `code-quality.md` ("No commented-out code in committed files — git has history" — the spirit applies to unused variables too) and a partial spec implementation.

## Expected

Either:
- Implement the persistence the spec asks for — add a `quests.combat_log` column via a new migration and write `combatLog` on each terminal transition, OR
- Delete the dead state. If the spec wants combat-log persistence later (Phase 9 narrative work touches this surface), drop a single comment pointing at the future task and remove the half-implementation.

A half-finished feature with no consumer makes the code lie about what it does — readers expect the log to go somewhere.

## Fix

Recommended: delete the unused `combatLog` accumulator and the `COMBAT_LOG_MAX_CHARS` constant. The WS `publishEvent` already fans the events out to anything that wants them; persistence can be reintroduced when a downstream consumer actually exists.

If keeping it as a placeholder is preferred, add a `quests.combat_log` column (migration `004_quest_combat_log.sql`) and write the accumulator inside the same combined UPDATE used to flip status to `complete`/`failed` (see review-1.md). Also expose it on the `Quest` schema so the client can read it.

# BUG: Audit endpoint silently swallows error details

**Severity:** HIGH
**File(s):** `packages/server/src/routes/quests.ts`

## Problem

The new `POST /quests/:id/audit` handler wraps the entire audit flow in a try/catch that discards the caught error entirely:

```ts
} catch {
  res.status(500).json({ error: 'Failed to run audit' });
}
```

- No error variable is captured (no `(err)`).
- The error is not logged anywhere.
- All failure modes — LLM adapter timeout, JSON parse failure, DB write failure, Zod parse on `rowToApi(row)` — collapse into the same generic message with no diagnostic trail.

If a user reports "Run audit just fails on my machine", an operator has no way to reproduce or diagnose. This is exactly the silent-error-swallowing pattern called out in `rules/common-findings.md` §8 ("18 tasks across 2 projects").

The audit logic itself (`audit-quest.ts:102`) at least includes an explanatory comment (`// adapter failure — deterministic gaps still surface`), but the route-level catch has neither error capture nor a justifying comment.

## Expected

Per `.claude/rules/common-findings.md` (Silent error swallowing) and `.claude/rules/observability-first.md` (structured logging from day one):

> Every catch block must surface the error OR have `// intentionally swallowed: <reason>`

The handler must either:
1. Capture the error and log it via `console.error` (or the project's logger if one exists), OR
2. Include a clear comment explaining why the error is intentionally discarded.

Bonus: distinguish "audit ran but adapter failed" (already handled inside `auditQuest` — returns deterministic gaps only) from genuine route-level failures (DB write, Zod parse). A route-level failure should ideally include the error's `message` in a server log for debugging.

## Fix

In `packages/server/src/routes/quests.ts` around line 185:

```ts
} catch (err) {
  console.error('POST /quests/:id/audit failed:', err);
  res.status(500).json({ error: 'Failed to run audit' });
}
```

Or, if a logger module exists, use that. The key requirement is that the original error is not lost.

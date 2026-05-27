# BUG: README labels seed step "Optional" but the documented walkthrough cannot complete without it

**Severity:** LOW
**File(s):** README.md

## Problem

The README's Phase 4 walkthrough block (line 130 onward) reads:

```bash
pnpm dev
# (Optional) seed demo data — idempotent
pnpm --filter=@code-quests/server tsx src/scripts/seed-dev.ts
```

Immediately followed by:

> Then in the browser at `http://localhost:5173`:
> 2. Select "Phase 4 Demo: Notify users on quest completion" → War Room opens

The quest "Phase 4 Demo: Notify users on quest completion" only exists after the seed runs. On a fresh checkout the walkthrough breaks at step 2 because the row isn't there.

Per `rules/spec/observability-first.md` and `rules/ux-design.md` (every screen answers "what do I do next?"), demo instructions must work for a first-time reader.

## Expected

Either:
- Mark the seed step **required** (or simply un-parenthesize it) when the rest of the walkthrough names that specific quest, or
- Reword the walkthrough so it doesn't reference the seeded title — e.g., "Open the War Room, draft a new quest with a description and ACs, then dispatch it."

## Fix

In README.md, change:

```
# (Optional) seed demo data — idempotent
pnpm --filter=@code-quests/server tsx src/scripts/seed-dev.ts
```

to:

```
# Seed demo data (idempotent — required for the walkthrough below)
pnpm --filter=@code-quests/server tsx src/scripts/seed-dev.ts
```

Or, better, fold the seed into `pnpm dev` and remove the separate step entirely (see review-2 for the auto-seed option).

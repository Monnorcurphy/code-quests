# BUG: Server PATCH validation does not mirror client-side AC / edge-case constraints

**Severity:** LOW
**File(s):** packages/server/src/routes/quests.ts, packages/shared/src/quest.ts

## Problem

The Oracle UI (packages/client/src/features/oracle.tsx) enforces:
- Each acceptance criterion: 1–500 characters, trimmed, non-empty
- Maximum 15 acceptance criteria per quest

The Tavern UI applies the same constraints to `edgeCases`.

The server's `PatchQuestSchema` (`packages/server/src/routes/quests.ts:23`, derived from `CreateQuestSchema` at line 9) and the shared `QuestSchema` (`packages/shared/src/quest.ts:21-23`) accept any string array with no length, item count, or per-item size constraints:

```ts
acceptanceCriteria: z.array(z.string()).default([]),
edgeCases: z.array(z.string()).default([]),
context: z.string().default(''),
```

A malicious or buggy client (curl, automated agent, or a future client that forgets to validate) can write 1000 ACs of 100KB each. The server stores it without complaint. The frontend will then choke trying to render the row.

Per `.claude/rules/input-validation.md` rule 4 ("Use schemas for both client and server"):

> "Define validation once (e.g., Zod schema) and derive both client-side validation and server-side validation from the same source."

And per `.claude/rules/cross-boundary-types.md`:

> "Every IPC call, API request, and event payload must have a corresponding validation schema (Zod, JSON Schema, pydantic, etc.) that validates the shape at runtime."

The current setup violates "single source of truth" — the constraints live only in the React component.

## Expected

Constraints should be enforced at the boundary (server PATCH validation) using the same Zod constants as the client. The shared package is the natural home.

## Fix

1. In `packages/shared/src/quest.ts`, add constants and a constrained schema for editable AC/edge-case items:
   ```ts
   export const AC_MAX_LENGTH = 500;
   export const AC_MAX_COUNT = 15;
   export const QuestAcItemSchema = z.string().trim().min(1).max(AC_MAX_LENGTH);
   export const QuestAcListSchema = z.array(QuestAcItemSchema).max(AC_MAX_COUNT);
   ```
2. Tighten `QuestSchema.acceptanceCriteria` and `QuestSchema.edgeCases` to use the new list schema (or keep `z.array(z.string())` for reads and only enforce on write).
3. In `packages/server/src/routes/quests.ts`, replace `acceptanceCriteria: z.array(z.string())` and `edgeCases: z.array(z.string())` in `CreateQuestSchema` with the shared `QuestAcListSchema` so PATCH/POST both reject oversized input.
4. Import the same `AC_MAX_LENGTH` / `AC_MAX_COUNT` constants in `oracle.tsx` and `tavern.tsx` to remove the duplicated `MAX_ACS = 15` / `.max(500)` literals.
5. Add a server unit test that PATCHing 16 ACs (or a 501-char AC) returns a 400 with a field-specific error.

# BUG: QuestSchema.equipment uses z.record(z.unknown()) instead of EquipmentSchema
**Severity:** HIGH
**File(s):** packages/shared/src/quest.ts

## Problem
The `QuestSchema` defines its `equipment` field as a free-form record:

```ts
// packages/shared/src/quest.ts:25
equipment: z.record(z.unknown()).default({}),
```

But `EquipmentSchema` exists in the same package and defines the exact shape:

```ts
// packages/shared/src/equipment.ts
export const EquipmentSchema = z.object({
  skillIds: z.array(z.string()).default([]),
  toolIds: z.array(z.string()).default([]),
  mcpServerIds: z.array(z.string()).default([]),
});
```

CLAUDE.md states: "Equipment = per-quest loadout = `{ skillIds, toolIds, mcpServerIds }`". The quest's `equipment` field is precisely a per-quest loadout — it should be validated as `EquipmentSchema`, not as an arbitrary record.

Today, `QuestSchema.parse({ ...valid, equipment: { foo: 'bar', skillIds: 'not-an-array' } })` passes. That defeats the point of having a Zod schema for cross-boundary validation.

## Expected
Per `rules/cross-boundary-type-safety.md`: "Every IPC call, API request, and event payload must have a corresponding validation schema... that validates the shape at runtime. Unvalidated boundaries are cross-boundary gaps."

Task ashford acceptance criterion: "Every schema rejects invalid input with a meaningful Zod error". A quest with malformed equipment is invalid input and must be rejected.

## Fix
1. In `packages/shared/src/quest.ts`, import and use `EquipmentSchema`:

   ```ts
   import { EquipmentSchema } from './equipment';

   // inside QuestSchema:
   equipment: EquipmentSchema.default({ skillIds: [], toolIds: [], mcpServerIds: [] }),
   ```

   Or simpler, since `EquipmentSchema.parse({})` already returns the defaulted object:

   ```ts
   equipment: EquipmentSchema.default(() => EquipmentSchema.parse({})),
   ```

2. Add a quest-test case verifying that a quest with malformed `equipment` (e.g., `{ skillIds: 'not-an-array' }`) is rejected.

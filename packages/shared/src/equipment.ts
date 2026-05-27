import { z } from 'zod';

export const EquipmentSchema = z.object({
  skillIds: z.array(z.string()).default([]),
  toolIds: z.array(z.string()).default([]),
  mcpServerIds: z.array(z.string()).default([]),
});

export type Equipment = z.infer<typeof EquipmentSchema>;

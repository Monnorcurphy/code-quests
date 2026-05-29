import { z } from 'zod';

export const ForgeSkillSchema = z.object({
  name: z.string().trim().min(1).max(80),
  monsterTypeIds: z.array(z.string()).min(1),
  implementation: z.string().max(2000).default(''),
});

export const ConfirmCandidateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  implementation: z.string().max(2000).optional(),
});

export type ForgeSkillInput = z.infer<typeof ForgeSkillSchema>;
export type ConfirmCandidateInput = z.infer<typeof ConfirmCandidateSchema>;

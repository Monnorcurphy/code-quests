import { z } from 'zod';
import { EquipmentSchema } from './equipment';
import { SpecAuditSchema } from './spec-audit';

export const AC_MAX_LENGTH = 500;
export const AC_MAX_COUNT = 15;
export const QuestAcItemSchema = z.string().trim().min(1).max(AC_MAX_LENGTH);
export const QuestAcListSchema = z.array(QuestAcItemSchema).max(AC_MAX_COUNT);

export const QuestStatusSchema = z.enum([
  'idle',
  'active',
  'complete',
  'failed',
  'paused_input',
  'user_blocked',
]);

export type QuestStatus = z.infer<typeof QuestStatusSchema>;

export const QuestSchema = z.object({
  id: z.string().min(1),
  epicId: z.string().min(1).nullable(),
  title: z.string().min(1),
  description: z.string().default(''),
  acceptanceCriteria: z.array(z.string()).default([]),
  edgeCases: z.array(z.string()).default([]),
  context: z.string().default(''),
  status: QuestStatusSchema.default('idle'),
  adventurerId: z.string().min(1).nullable(),
  agentId: z.string().nullable(),
  equipment: EquipmentSchema.default({ skillIds: [], toolIds: [], mcpServerIds: [] }),
  specAudit: SpecAuditSchema.nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Quest = z.infer<typeof QuestSchema>;

export const EpicSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  goal: z.string().min(1),
  createdAt: z.string(),
});

export type Epic = z.infer<typeof EpicSchema>;
